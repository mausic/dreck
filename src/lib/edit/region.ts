import { createServerFn } from "@tanstack/react-start";
import { generateObject } from "ai";
import type { TContentPatch } from "@/lib/ai/content-patch";
import type { TEditRegionInput, TEditRegionResult } from "@/lib/edit/schema";
import type { TSlotContent } from "@/lib/slides/types";
import { getDb } from "@/db/client";
import {
  loadSlideForEdit,
  updateSlideAfterEdit,
} from "@/db/queries/slides.server";
import {
  EditModelInputSchema,
  EditPatchSchema,
  EditRegionInputSchema,
  toSlotContent,
} from "@/lib/edit/schema";
import { EDIT_SYSTEM_PROMPT, buildEditPrompt } from "@/lib/edit/prompt";
import { verifySlideGrounding } from "@/lib/ai/grounding";
import { MODEL_TIMEOUT_MS, getEditModel } from "@/lib/ai/model";
import { verifySlideFit } from "@/lib/ai/fit";
import { isLabelValue, isPanelContent, toLines } from "@/lib/slides/content";
import { applyPatch, patchFromUpdates } from "@/lib/slides/edit";
import { editableElementsInRect } from "@/lib/slides/geometry";
import { toWireSlide } from "@/lib/slides/wire";

function contentKind(content: TSlotContent): TContentPatch["kind"] {
  if (typeof content === "string") return "text";
  if (Array.isArray(content)) return "lines";
  if (isLabelValue(content)) return "labelValue";
  if (isPanelContent(content)) return "panel";
  return "text";
}

function groundingIssueKey(issue: {
  elementId: string;
  token: string;
}): string {
  return `${issue.elementId}\u0000${issue.token}`;
}

function fitIssueKey(issue: { elementId: string; part?: string }): string {
  return `${issue.elementId}\u0000${issue.part ?? "element"}`;
}

export const editRegion = createServerFn({ method: "POST" })
  .validator((input: TEditRegionInput) => EditRegionInputSchema.parse(input))
  .handler(async ({ data }): Promise<TEditRegionResult> => {
    try {
      const db = getDb();
      const stored = await loadSlideForEdit(db, data.deckId, data.slideId);
      if (stored.revision !== data.expectedRevision) {
        return {
          ok: false,
          error:
            "This slide changed while you were editing it. Try the edit again.",
          conflict: {
            slide: toWireSlide(stored.slide),
            revision: stored.revision,
            grounding: stored.grounding,
          },
        };
      }

      const selected = editableElementsInRect(
        data.selection,
        stored.slide.elements,
      );
      if (selected.length === 0) {
        return {
          ok: false,
          error: "The selected region contains no editable elements.",
        };
      }
      const allowedIds = new Set(selected.map((element) => element.id));
      const modelData = EditModelInputSchema.parse({
        instruction: data.instruction,
        targets: selected.map((element) => ({
          id: element.id,
          role: element.role,
          content: element.content,
        })),
        context: stored.slide.elements
          .filter((element) => !allowedIds.has(element.id))
          .flatMap((element) => toLines(element.content)),
        tokens: stored.tokens,
      });

      const { object } = await generateObject({
        model: getEditModel(),
        schema: EditPatchSchema,
        system: EDIT_SYSTEM_PROMPT,
        prompt: buildEditPrompt(modelData),
        maxRetries: 1,
        abortSignal: AbortSignal.timeout(MODEL_TIMEOUT_MS),
      });

      const updatesById = new Map<string, (typeof object.updates)[number]>();
      for (const update of object.updates) {
        if (
          !allowedIds.has(update.elementId) ||
          updatesById.has(update.elementId)
        ) {
          return {
            ok: false,
            error: "The edit returned an invalid element set.",
          };
        }
        updatesById.set(update.elementId, update);
      }
      if (updatesById.size !== selected.length) {
        return {
          ok: false,
          error: "The edit did not update every selected element.",
        };
      }
      for (const element of selected) {
        if (
          updatesById.get(element.id)?.content.kind !==
          contentKind(element.content)
        ) {
          return {
            ok: false,
            error: "The edit changed an element's content shape.",
          };
        }
      }

      const currentContent = new Map(
        selected.map((element) => [element.id, element.content]),
      );
      const changedUpdates = object.updates
        .map((update) => ({
          elementId: update.elementId,
          content: toSlotContent(update.content),
        }))
        .filter(
          (update) =>
            JSON.stringify(currentContent.get(update.elementId)) !==
            JSON.stringify(update.content),
        );
      const patch = patchFromUpdates(changedUpdates, allowedIds);

      if (Object.keys(patch).length === 0) {
        return { ok: false, error: "The edit produced no changes to apply." };
      }
      const nextSlide = applyPatch(stored.slide, patch);
      const previousFit = verifySlideFit(stored.slide);
      const previousFitByElement = new Map(
        previousFit.issues.map((issue) => [fitIssueKey(issue), issue]),
      );
      const worsenedFit = verifySlideFit(nextSlide).issues.filter((issue) => {
        if (!allowedIds.has(issue.elementId)) return false;
        const previous = previousFitByElement.get(fitIssueKey(issue));
        return !previous || issue.chars > previous.chars;
      });
      if (worsenedFit.length > 0) {
        return {
          ok: false,
          error:
            "The edited copy does not fit the selected region. Try asking for a shorter version.",
        };
      }
      const previousGrounding = verifySlideGrounding(
        stored.slide,
        stored.sourceMarkdown,
      );
      const grounding = verifySlideGrounding(nextSlide, stored.sourceMarkdown);
      const previousIssues = new Set(
        previousGrounding.issues.map(groundingIssueKey),
      );
      const newIssues = grounding.issues.filter(
        (issue) => !previousIssues.has(groundingIssueKey(issue)),
      );
      if (newIssues.length > 0) {
        return {
          ok: false,
          error: `The edit introduced unsupported values: ${newIssues.map((issue) => issue.token).join(", ")}.`,
        };
      }

      const revision = await updateSlideAfterEdit(db, {
        deckId: data.deckId,
        slideId: data.slideId,
        expectedRevision: data.expectedRevision,
        slide: nextSlide,
        grounding,
      });
      if (revision === null) {
        const current = await loadSlideForEdit(db, data.deckId, data.slideId);
        return {
          ok: false,
          error:
            "This slide changed while you were editing it. Try the edit again.",
          conflict: {
            slide: toWireSlide(current.slide),
            revision: current.revision,
            grounding: current.grounding,
          },
        };
      }
      return { ok: true, patch, revision, grounding };
    } catch (error) {
      console.error(
        JSON.stringify({
          message: "region edit failed",
          error: error instanceof Error ? error.message : String(error),
          deckId: data.deckId,
          slideId: data.slideId,
        }),
      );
      return {
        ok: false,
        error: "The edit couldn't be applied. Try rephrasing your instruction.",
      };
    }
  });

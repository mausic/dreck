/**
 * `editRegion` — the TanStack Start server function behind the edit seam.
 *
 * The client sends the selection + instruction; the server does the single structured
 * model call (`generateObject`, no agent, no tool loop) and returns a `TEditPatch`. The
 * provider key stays server-side. Everything downstream (`applyPatch`, re-render) is
 * unchanged from Task 2 — this only fills the seam where the mock used to be.
 *
 * Robustness: the handler never throws to the client. A missing key, a model failure, an
 * output that doesn't parse against `EditPatchSchema`, or an update aimed at a
 * non-selected id all resolve to `{ ok: false }`, leaving the deck untouched.
 */
import { createServerFn } from "@tanstack/react-start";
import { generateObject } from "ai";
import type { TEditRegionInput, TEditRegionResult } from "@/lib/ai/edit-schema";
import {
  EditPatchSchema,
  EditRegionInputSchema,
  toSlotContent,
} from "@/lib/ai/edit-schema";
import { EDIT_SYSTEM_PROMPT, buildEditPrompt } from "@/lib/ai/edit-prompt";
import { getEditModel } from "@/lib/ai/model";
import { patchFromUpdates } from "@/lib/slides/edit";

export const editRegion = createServerFn({ method: "POST" })
  .validator((input: TEditRegionInput) => EditRegionInputSchema.parse(input))
  .handler(async ({ data }): Promise<TEditRegionResult> => {
    // The only ids the model is allowed to touch — the hit-tested selection.
    const allowedIds = new Set(data.targets.map((t) => t.id));

    try {
      const { object } = await generateObject({
        model: getEditModel(),
        schema: EditPatchSchema,
        system: EDIT_SYSTEM_PROMPT,
        prompt: buildEditPrompt(data),
        // One retry beyond the initial attempt for transient/parse failures.
        maxRetries: 1,
      });

      // Convert tagged content → native, then structurally constrain: content-only,
      // selected ids only. Anything the model aimed elsewhere is dropped here.
      const patch = patchFromUpdates(
        object.updates.map((u) => ({
          elementId: u.elementId,
          content: toSlotContent(u.content),
        })),
        allowedIds,
      );

      if (Object.keys(patch).length === 0) {
        return { ok: false, error: "The edit produced no changes to apply." };
      }
      return { ok: true, patch };
    } catch {
      // NoObjectGeneratedError, provider/network errors, missing key — all soft-fail.
      return {
        ok: false,
        error: "The edit couldn't be applied. Try rephrasing your instruction.",
      };
    }
  });

import { createServerFn } from "@tanstack/react-start";
import type { ISection } from "@/lib/extract/section";
import type { IArchetype, ITokens } from "@/lib/slides/types";
import type { IDeckDesign } from "@/db/queries/documents.server";
import type {
  IGroundingReport,
  IWireSlide,
  TGenerateDeckInput,
  TGenerationEvent,
  TSlidePlan,
  TSlidePlanItem,
} from "@/lib/generate/schema";
import { getDb } from "@/db/client";
import {
  createDeck,
  finishDeckGeneration,
  persistSlide,
} from "@/db/queries/decks.server";
import {
  loadContentDocument,
  loadDeckDesign,
} from "@/db/queries/documents.server";
import {
  ARCHETYPE_FAMILY_DESCRIPTORS,
  getArchetype,
} from "@/lib/slides/archetypes";
import { GenerateDeckInputSchema } from "@/lib/generate/schema";
import { fallbackPlan, planDeck } from "@/lib/generate/plan";
import {
  planArchetypes,
  planExtractedArchetypes,
} from "@/lib/generate/pick-archetype";
import { fillSlide } from "@/lib/generate/fill";
import { verifySlideGrounding } from "@/lib/ai/grounding";
import { describeFitIssues, verifySlideFit } from "@/lib/ai/fit";
import {
  isPlanGroundedToSections,
  selectSections,
  summarizeSections,
} from "@/lib/generate/sections";
import { describeGroundingIssues } from "@/lib/generate/prompt";
import { fatalProviderMessage, isFatalProviderError } from "@/lib/ai/retry";
import { runWithConcurrency } from "@/lib/ai/concurrency";
import { getGenerationConfig } from "@/lib/config/generate-config";

type TDb = ReturnType<typeof getDb>;

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Generation failed.";
}

function retryNote(
  grounding: IGroundingReport,
  fit: ReturnType<typeof verifySlideFit>,
): string {
  const parts: Array<string> = [];
  if (!grounding.ok) {
    parts.push(
      `These values are NOT in the source — remove or correct them: ${describeGroundingIssues(grounding.issues)}.`,
    );
  }
  if (!fit.ok) {
    parts.push(
      `These slots overflow their box — make them shorter: ${describeFitIssues(fit.issues)}.`,
    );
  }
  return parts.join(" ");
}

async function buildOneSlide(args: {
  slideId: string;
  item: TSlidePlanItem;
  sections: Array<ISection>;
  archetype: IArchetype;
  markdown: string;
  tokens: ITokens;
}): Promise<{ slide: IWireSlide; grounding: IGroundingReport }> {
  const generationConfig = getGenerationConfig();
  const base = {
    slideId: args.slideId,
    intent: args.item.intent,
    title: args.item.title,
    archetype: args.archetype,
    sections: args.sections,
    tokens: args.tokens,
  };

  const maxRetries = generationConfig.GENERATE_FILL_RETRIES;
  let slide = await fillSlide(base);
  let grounding = verifySlideGrounding(slide, args.markdown);
  let fit = verifySlideFit(slide);

  for (
    let attempt = 0;
    attempt < maxRetries && (!grounding.ok || !fit.ok);
    attempt++
  ) {
    slide = await fillSlide({
      ...base,
      failureNote: retryNote(grounding, fit),
    });
    grounding = verifySlideGrounding(slide, args.markdown);
    fit = verifySlideFit(slide);
  }

  return { slide, grounding };
}

type TSlideOutcome =
  | {
      kind: "slide";
      index: number;
      slide: IWireSlide;
      grounding: IGroundingReport;
    }
  | { kind: "error"; index: number; message: string }
  | { kind: "fatal"; message: string };

async function generateSlideTask(
  db: TDb,
  deckId: string,
  index: number,
  item: TSlidePlanItem,
  sections: Array<ISection>,
  archetype: IArchetype,
  markdown: string,
  tokens: ITokens,
): Promise<TSlideOutcome> {
  try {
    const { slide, grounding } = await buildOneSlide({
      slideId: `${deckId}-s${index + 1}`,
      item,
      sections,
      archetype,
      markdown,
      tokens,
    });
    await persistSlide(db, { deckId, index, slide, grounding });
    return { kind: "slide", index, slide, grounding };
  } catch (error) {
    if (isFatalProviderError(error)) {
      return { kind: "fatal", message: fatalProviderMessage(error) };
    }
    return { kind: "error", index, message: errorMessage(error) };
  }
}

export const generateDeck = createServerFn({ method: "POST" })
  .validator((input: TGenerateDeckInput) =>
    GenerateDeckInputSchema.parse(input),
  )
  .handler(async function* ({ data }): AsyncGenerator<TGenerationEvent> {
    let db: TDb;
    let doc: { markdown: string; sections: Array<ISection> };
    let design: IDeckDesign;
    try {
      db = getDb();
      doc = await loadContentDocument(db, data.contentDocId);
      design = await loadDeckDesign(db, data.designDocId);
    } catch (error) {
      yield { type: "error", message: errorMessage(error) };
      return;
    }

    const plannerArchetypes = design.archetypes ?? ARCHETYPE_FAMILY_DESCRIPTORS;

    let plan: TSlidePlan;
    try {
      plan = await planDeck(
        data.prompt,
        summarizeSections(doc.sections),
        plannerArchetypes,
      );
      if (!isPlanGroundedToSections(plan, doc.sections)) {
        plan = fallbackPlan(doc.sections);
      }
    } catch (error) {
      if (isFatalProviderError(error)) {
        yield { type: "error", message: fatalProviderMessage(error) };
        return;
      }
      plan = fallbackPlan(doc.sections);
    }

    let deckId: string;
    try {
      deckId = await createDeck(db, {
        contentDocId: data.contentDocId,
        designDocId: data.designDocId,
        prompt: data.prompt,
        plan,
        tokens: design.tokens,
      });
    } catch (error) {
      yield { type: "error", message: errorMessage(error) };
      return;
    }
    const successfulIndices = new Set<number>();
    let fatalMessage: string | undefined;
    let terminalError: string | undefined;
    let finalizationError: string | undefined;
    let status: "complete" | "partial" | "failed" = "failed";

    try {
      yield { type: "plan", deckId, plan, tokens: design.tokens };

      const perSlide = plan.slides.map((item, index) => ({
        item,
        index,
        sections: selectSections(doc.sections, item.sectionIds),
      }));
      const resolvedArchetypes: Array<IArchetype> = design.archetypes
        ? planExtractedArchetypes(perSlide, design.archetypes)
        : planArchetypes(perSlide).map((id) => {
            const archetype = getArchetype(id);
            if (!archetype)
              throw new Error(`Unknown built-in archetype: ${id}`);
            return archetype;
          });
      const tasks = perSlide.map(
        (slide, index) => () =>
          generateSlideTask(
            db,
            deckId,
            slide.index,
            slide.item,
            slide.sections,
            resolvedArchetypes[index],
            doc.markdown,
            design.tokens,
          ),
      );

      for await (const outcome of runWithConcurrency(
        tasks,
        getGenerationConfig().GENERATE_CONCURRENCY,
        (value) => value.kind !== "fatal",
      )) {
        if (outcome.kind === "fatal") {
          if (!fatalMessage) {
            fatalMessage = outcome.message;
            yield { type: "error", message: outcome.message };
          }
          continue;
        }
        if (outcome.kind === "slide") {
          successfulIndices.add(outcome.index);
          yield {
            type: "slide",
            index: outcome.index,
            slide: outcome.slide,
            grounding: outcome.grounding,
          };
        } else {
          yield {
            type: "error",
            index: outcome.index,
            message: outcome.message,
          };
        }
      }
    } catch (error) {
      terminalError = errorMessage(error);
      yield { type: "error", message: terminalError };
    } finally {
      try {
        status = await finishDeckGeneration(db, {
          deckId,
          expectedSlideCount: plan.slides.length,
          generatedSlideCount: successfulIndices.size,
          error: terminalError ?? fatalMessage,
        });
      } catch (error) {
        finalizationError = errorMessage(error);
        console.error(
          JSON.stringify({
            message: "deck finalization failed",
            error: finalizationError,
            deckId,
          }),
        );
      }
    }

    if (finalizationError) {
      yield { type: "error", message: finalizationError };
      return;
    }
    const failedIndices = plan.slides.flatMap((_, index) =>
      successfulIndices.has(index) ? [] : [index],
    );
    yield {
      type: "done",
      deckId,
      expectedSlideCount: plan.slides.length,
      generatedSlideCount: successfulIndices.size,
      failedIndices,
      status,
    };
  });

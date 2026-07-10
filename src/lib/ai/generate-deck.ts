/**
 * `generateDeck` — the TanStack Start server function behind generation. It is the ORCHESTRATOR:
 * the model only plans and fills; this code owns the loop (plan → for each slide: pick archetype
 * → fill → verify with bounded retry → persist → stream). No agent, no durable-execution engine —
 * a plain async generator that yields one {@link TGenerationEvent} per step, so slides paint
 * progressively (slide 1 renders while slide 2 is still generating).
 *
 * Robustness mirrors the edit/extract seams: the generator never throws to the client. A missing
 * key, a bad document id, a DB error, or a per-slide failure all become `error` events; the deck
 * keeps going where it can. Design tokens/archetypes are the hardcoded set for now, consumed via
 * the stable archetype interface so real extraction swaps in behind it later.
 */
import { createServerFn } from "@tanstack/react-start";
import { desc, eq } from "drizzle-orm";
import type { ISection } from "@/lib/extract/section";
import type { ISlide } from "@/lib/slides/types";
import type {
  IGroundingReport,
  IWireSlide,
  TGenerateDeckInput,
  TGenerationEvent,
  TSlidePlan,
  TSlidePlanItem,
} from "@/lib/ai/generate-schema";
import { getDb } from "@/db/client";
import { decks, documents, slides } from "@/db/schema";
import { ARCHETYPES, getArchetype } from "@/lib/slides/archetypes";
import { PHARMA_TOKENS } from "@/lib/slides/tokens";
import { GenerateDeckInputSchema } from "@/lib/ai/generate-schema";
import { fallbackPlan, planDeck } from "@/lib/ai/plan";
import { pickArchetype } from "@/lib/ai/pick-archetype";
import { fillSlide } from "@/lib/ai/fill";
import { verifySlideGrounding } from "@/lib/ai/grounding";
import { selectSections, summarizeSections } from "@/lib/ai/sections";
import { describeGroundingIssues } from "@/lib/ai/generate-prompt";

/** Retry budget for an ungrounded slide. Bounded — never loops unbounded (spec). */
const MAX_FILL_RETRIES = 1;

type TDb = ReturnType<typeof getDb>;

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Generation failed.";
}

/** Load the content document's markdown + section tree by id (server-side only). */
async function loadContentDocument(
  db: TDb,
  id: string,
): Promise<{ markdown: string; sections: Array<ISection> }> {
  const rows = await db
    .select({
      markdown: documents.markdown,
      sections: documents.sections,
      role: documents.role,
    })
    .from(documents)
    .where(eq(documents.id, id))
    .limit(1);

  if (rows.length === 0) {
    throw new Error(
      "Content document not found — extract a content PDF first.",
    );
  }
  const row = rows[0];
  if (row.role !== "content") {
    throw new Error("Selected document is a design PDF, not content.");
  }
  return { markdown: row.markdown, sections: row.sections };
}

/** Insert the deck row and return its id. Persisted before any slide, so slides can FK to it. */
async function createDeckRow(
  db: TDb,
  data: TGenerateDeckInput,
  plan: TSlidePlan,
): Promise<string> {
  const [row] = await db
    .insert(decks)
    .values({ contentDocId: data.contentDocId, prompt: data.prompt, plan })
    .returning({ id: decks.id });
  return row.id;
}

/** Persist one finished slide (flat model as jsonb) + its grounding report. */
async function persistSlide(
  db: TDb,
  deckId: string,
  index: number,
  slide: ISlide,
  grounding: IGroundingReport,
): Promise<void> {
  await db.insert(slides).values({
    deckId,
    index,
    archetypeId: slide.archetypeId,
    slide,
    grounding,
  });
}

/**
 * The per-slide pipeline core: fill → verify → (retry once if ungrounded) → verify. The slide is
 * kept either way; if it's still ungrounded after the retry budget it ships flagged, never dropped
 * and never looped.
 */
async function buildOneSlide(args: {
  slideId: string;
  item: TSlidePlanItem;
  sections: Array<ISection>;
  archetypeId: string;
  markdown: string;
}): Promise<{ slide: IWireSlide; grounding: IGroundingReport }> {
  const archetype = getArchetype(args.archetypeId);
  const base = {
    slideId: args.slideId,
    intent: args.item.intent,
    title: args.item.title,
    archetype,
    sections: args.sections,
    tokens: PHARMA_TOKENS,
  };

  let slide = await fillSlide(base);
  let grounding = verifySlideGrounding(slide, args.markdown);

  for (
    let attempt = 0;
    attempt < MAX_FILL_RETRIES && !grounding.ok;
    attempt++
  ) {
    slide = await fillSlide({
      ...base,
      failureNote: describeGroundingIssues(grounding.issues),
    });
    grounding = verifySlideGrounding(slide, args.markdown);
  }

  return { slide, grounding };
}

export const generateDeck = createServerFn({ method: "POST" })
  .validator((input: TGenerateDeckInput) =>
    GenerateDeckInputSchema.parse(input),
  )
  .handler(async function* ({ data }): AsyncGenerator<TGenerationEvent> {
    // Fill needs the model, so a missing key can't produce any slide — fail fast with one clear
    // error rather than N identical per-slide failures.
    if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
      yield {
        type: "error",
        message: "GOOGLE_GENERATIVE_AI_API_KEY is not set.",
      };
      return;
    }

    let db: TDb;
    let doc: { markdown: string; sections: Array<ISection> };
    try {
      db = getDb();
      doc = await loadContentDocument(db, data.contentDocId);
    } catch (error) {
      yield { type: "error", message: errorMessage(error) };
      return;
    }

    const archetypeIds = Object.keys(ARCHETYPES);

    // Plan (one model call) with a deterministic fallback — a planner hiccup never breaks gen.
    let plan: TSlidePlan;
    try {
      plan = await planDeck(
        data.prompt,
        summarizeSections(doc.sections),
        archetypeIds,
      );
      if (plan.slides.length === 0) plan = fallbackPlan(doc.sections);
    } catch {
      plan = fallbackPlan(doc.sections);
    }

    let deckId: string;
    try {
      deckId = await createDeckRow(db, data, plan);
    } catch (error) {
      yield { type: "error", message: errorMessage(error) };
      return;
    }
    yield { type: "plan", deckId, plan };

    for (let i = 0; i < plan.slides.length; i++) {
      const item = plan.slides[i];
      const slideId = `${deckId}-s${i + 1}`;
      try {
        const sections = selectSections(doc.sections, item.sectionIds);
        const archetypeId = pickArchetype(item, sections, ARCHETYPES);
        const { slide, grounding } = await buildOneSlide({
          slideId,
          item,
          sections,
          archetypeId,
          markdown: doc.markdown,
        });
        await persistSlide(db, deckId, i, slide, grounding);
        yield { type: "slide", index: i, slide, grounding };
      } catch (error) {
        yield { type: "error", index: i, message: errorMessage(error) };
      }
    }

    yield { type: "done", deckId, slideCount: plan.slides.length };
  });

/** List recent content documents for the generate panel's source picker (newest first). */
export const listRecentContentDocs = createServerFn({ method: "GET" }).handler(
  async () => {
    try {
      const db = getDb();
      const docs = await db
        .select({ id: documents.id, sourceName: documents.sourceName })
        .from(documents)
        .where(eq(documents.role, "content"))
        .orderBy(desc(documents.createdAt))
        .limit(20);
      return { ok: true as const, docs };
    } catch (error) {
      return { ok: false as const, error: errorMessage(error) };
    }
  },
);

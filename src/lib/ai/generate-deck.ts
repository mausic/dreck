/**
 * `generateDeck` — the TanStack Start server function behind generation. It is the ORCHESTRATOR:
 * the model only plans and fills; this code owns the loop (plan → then, per slide: pick archetype
 * → fill → verify with bounded retry → persist). No agent, no durable-execution engine — a plain
 * async generator. Slides are generated with bounded concurrency (the `GENERATE_CONCURRENCY` env
 * knob, in flight) and each is streamed the moment it completes, so slides paint progressively as
 * they land (out of submission order — the client places each by its `index`).
 *
 * Robustness mirrors the edit/extract seams: the generator never throws to the client. A missing
 * key, a bad document id, a DB error, or a per-slide failure all become `error` events; the deck
 * keeps going where it can. A selected design document supplies a request-scoped extracted
 * archetype catalog; existing documents without one continue through the built-in catalog.
 */
import { createServerFn } from "@tanstack/react-start";
import { desc, eq } from "drizzle-orm";
import type { ISection } from "@/lib/extract/section";
import type {
  IArchetype,
  IExtractedArchetype,
  ISlide,
  ITokens,
} from "@/lib/slides/types";
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
import {
  ARCHETYPE_FAMILY_DESCRIPTORS,
  getArchetype,
} from "@/lib/slides/archetypes";
import { ExtractedArchetypesSchema } from "@/lib/slides/archetype-schema";
import { DESIGN_TOKENS } from "@/lib/slides/tokens";
import { GenerateDeckInputSchema } from "@/lib/ai/generate-schema";
import { fallbackPlan, planDeck } from "@/lib/ai/plan";
import {
  planArchetypes,
  planExtractedArchetypes,
} from "@/lib/ai/pick-archetype";
import { fillSlide } from "@/lib/ai/fill";
import { verifySlideGrounding } from "@/lib/ai/grounding";
import { describeFitIssues, verifySlideFit } from "@/lib/ai/fit";
import { selectSections, summarizeSections } from "@/lib/ai/sections";
import { describeGroundingIssues } from "@/lib/ai/generate-prompt";
import { fatalProviderMessage, isFatalProviderError } from "@/lib/ai/retry";
import { runWithConcurrency } from "@/lib/ai/concurrency";
import { getConfig } from "@/lib/config";
import { enhanceExtractedArchetypes } from "@/lib/extract/enhance-archetypes";

type TDb = ReturnType<typeof getDb>;

interface IDeckDesign {
  tokens: ITokens;
  archetypes: Array<IExtractedArchetype> | null;
}

function prepareStoredArchetypes(
  value: unknown,
): Array<IExtractedArchetype> | null {
  const parsed = ExtractedArchetypesSchema.safeParse(value);
  if (!parsed.success) return null;
  try {
    return enhanceExtractedArchetypes(parsed.data).archetypes;
  } catch {
    return null;
  }
}

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

/**
 * Resolve the cached design system for a deck. Existing design rows without extracted archetypes
 * keep their tokens and use the built-in catalog.
 */
async function loadDeckDesign(
  db: TDb,
  designDocId: string | undefined,
): Promise<IDeckDesign> {
  const fallback: IDeckDesign = { tokens: DESIGN_TOKENS, archetypes: null };
  if (!designDocId) return fallback;
  try {
    const rows = await db
      .select({
        role: documents.role,
        designTokens: documents.designTokens,
        designArchetypes: documents.designArchetypes,
      })
      .from(documents)
      .where(eq(documents.id, designDocId))
      .limit(1);
    if (rows.length === 0) return fallback;
    const row = rows[0];
    if (row.role !== "design") return fallback;
    return {
      tokens: row.designTokens ?? DESIGN_TOKENS,
      archetypes: prepareStoredArchetypes(row.designArchetypes),
    };
  } catch {
    return fallback;
  }
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

/** Compose the retry note from whichever checks failed — ungrounded figures and/or overflow. */
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

/**
 * The per-slide pipeline core: fill → verify (grounding + fit) → (regenerate once if either
 * fails) → verify. The slide is kept either way; if it still fails after the retry budget it
 * ships as-is (grounding flagged, overflow clipped) — never dropped, never looped.
 */
async function buildOneSlide(args: {
  slideId: string;
  item: TSlidePlanItem;
  sections: Array<ISection>;
  archetype: IArchetype;
  markdown: string;
  tokens: ITokens;
}): Promise<{ slide: IWireSlide; grounding: IGroundingReport }> {
  const generationConfig = getConfig().generation;
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

/** The result of one slide task — a finished slide, a per-slide failure, or a fatal wall. */
type TSlideOutcome =
  | {
      kind: "slide";
      index: number;
      slide: IWireSlide;
      grounding: IGroundingReport;
    }
  | { kind: "error"; index: number; message: string }
  | { kind: "fatal"; message: string };

/**
 * Build + persist one slide, classified into a {@link TSlideOutcome}. Total (never throws) so it
 * is safe to run many of these concurrently — a per-slide failure becomes data, and a fatal
 * provider wall (quota/auth) is tagged so the orchestrator can stop the whole deck once.
 */
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
    await persistSlide(db, deckId, index, slide, grounding);
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

    // Plan (one model call) with a deterministic fallback — a planner hiccup never breaks gen.
    // But a fatal provider error (quota/auth) would doom every fill too, so abort now with a
    // clear message rather than falling back into a deck that can't be filled.
    let plan: TSlidePlan;
    try {
      plan = await planDeck(
        data.prompt,
        summarizeSections(doc.sections),
        plannerArchetypes,
      );
      if (plan.slides.length === 0) plan = fallbackPlan(doc.sections);
    } catch (error) {
      if (isFatalProviderError(error)) {
        yield { type: "error", message: fatalProviderMessage(error) };
        return;
      }
      plan = fallbackPlan(doc.sections);
    }

    let deckId: string;
    try {
      deckId = await createDeckRow(db, data, plan);
    } catch (error) {
      yield { type: "error", message: errorMessage(error) };
      return;
    }
    // The plan event carries the resolved design tokens so the client styles the deck with the
    // extracted design system (fonts/palette) as slides stream in.
    yield { type: "plan", deckId, plan, tokens: design.tokens };

    // Generate the slides with bounded concurrency (GENERATE_CONCURRENCY in flight), emitting each
    // as it completes. The tasks are total, so the pool never throws; a fatal provider wall hits
    // every slide the same way, so surface it once and stop launching more.
    // Resolve each slide's sections, then choose archetypes for the WHOLE deck up-front: the fill
    // loop below runs slides concurrently, so a per-slide selector couldn't diversify layouts —
    // planArchetypes applies its cross-slide diversity penalty here, before any fill starts.
    const perSlide = plan.slides.map((item, index) => ({
      item,
      index,
      sections: selectSections(doc.sections, item.sectionIds),
    }));
    const resolvedArchetypes: Array<IArchetype> = design.archetypes
      ? planExtractedArchetypes(perSlide, design.archetypes)
      : planArchetypes(perSlide).map((id) => {
          const archetype = getArchetype(id);
          if (!archetype) throw new Error(`Unknown built-in archetype: ${id}`);
          return archetype;
        });

    const tasks = perSlide.map(
      (slide, i) => () =>
        generateSlideTask(
          db,
          deckId,
          slide.index,
          slide.item,
          slide.sections,
          resolvedArchetypes[i],
          doc.markdown,
          design.tokens,
        ),
    );
    const generationConfig = getConfig().generation;

    for await (const outcome of runWithConcurrency(
      tasks,
      generationConfig.GENERATE_CONCURRENCY,
    )) {
      if (outcome.kind === "fatal") {
        yield { type: "error", message: outcome.message };
        return;
      }
      if (outcome.kind === "slide") {
        yield {
          type: "slide",
          index: outcome.index,
          slide: outcome.slide,
          grounding: outcome.grounding,
        };
      } else {
        yield { type: "error", index: outcome.index, message: outcome.message };
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

/**
 * List recent design documents (those with an extracted design system) for the panel's picker.
 * Includes the cached tokens + feel so selecting one can preview its design system without a
 * second round-trip.
 */
export const listRecentDesignDocs = createServerFn({ method: "GET" }).handler(
  async () => {
    try {
      const db = getDb();
      const docs = await db
        .select({
          id: documents.id,
          sourceName: documents.sourceName,
          designTokens: documents.designTokens,
          designFeel: documents.designFeel,
          designArchetypes: documents.designArchetypes,
        })
        .from(documents)
        .where(eq(documents.role, "design"))
        .orderBy(desc(documents.createdAt))
        .limit(20);
      return {
        ok: true as const,
        docs: docs.map((doc) => ({
          ...doc,
          designArchetypes: prepareStoredArchetypes(doc.designArchetypes),
        })),
      };
    } catch (error) {
      return { ok: false as const, error: errorMessage(error) };
    }
  },
);

/**
 * The wire contracts for deck generation.
 *
 * Three schemas sit across the pipeline:
 *   • {@link SlidePlanSchema} — the planner's output. The model decides how many slides and
 *     what each covers from the user's prompt; slide count is never hardcoded.
 *   • {@link SlideFillSchema} — the per-slide fill's output. Deliberately content-ONLY, keyed
 *     by archetype slot id: geometry/role/styleRef are copied off the archetype in code, so a
 *     fill can never move or restyle anything (the same structural guarantee edits have).
 *   • {@link GenerateDeckInputSchema} — what the client sends: a stored content document + the
 *     chat prompt (the markdown/sections stay server-side, keyed by id).
 *
 * {@link TGenerationEvent} is the streamed protocol: the server function is an async generator
 * that yields one of these per step so slides paint progressively. Grounding flags ride in the
 * `slide` event (and a sibling DB column), never inside {@link ISlide} — the flat slide model
 * is unchanged, so the existing renderer/editor consume generated slides untouched.
 */
import { z } from "zod";
import type { ISlide, ISlideElement, TSlotRole } from "@/lib/slides/types";
import type { TWireContent } from "@/lib/ai/content-patch";
import { zContentPatch } from "@/lib/ai/content-patch";

/** Upper bound on planned slides — a guard, not the target (the prompt drives the count). */
export const MAX_SLIDES = 8;

/** One planned slide: what it's about, its title, which sections feed it, a suggested archetype. */
export const SlidePlanItemSchema = z.object({
  /** What this slide is about (a short intent phrase the fill step is steered by). */
  intent: z.string(),
  /** The slide's working title. */
  title: z.string(),
  /** Section-tree ids whose verbatim content feeds this slide. May be empty (e.g. a cover). */
  sectionIds: z.array(z.string()),
  /** Suggested archetype id from the available set. Optional — code picks one if absent/unknown. */
  archetypeId: z.string().optional(),
});
export type TSlidePlanItem = z.infer<typeof SlidePlanItemSchema>;

/** The planner's full output: an ordered list of planned slides. */
export const SlidePlanSchema = z.object({
  slides: z.array(SlidePlanItemSchema).min(1).max(MAX_SLIDES),
});
export type TSlidePlan = z.infer<typeof SlidePlanSchema>;

/**
 * The per-slide fill's output: content for each archetype slot, keyed by slot id, tagged with
 * its {@link zContentPatch} kind. Pure-visual slots (backgrounds, rules) are simply omitted.
 */
export const SlideFillSchema = z.object({
  slots: z.array(
    z.object({
      /** Must match an archetype slot id; unmatched entries are dropped at assembly. */
      slotId: z.string(),
      content: zContentPatch,
    }),
  ),
});
export type TSlideFill = z.infer<typeof SlideFillSchema>;

/**
 * A single ungrounded factual token: the {@link verifySlideGrounding} step found a
 * number/dose/figure on a generated element that does not appear in the source markdown.
 */
export interface IGroundingIssue {
  /** The slide element the token was found on. */
  elementId: string;
  /** The element's role, for surfacing the flag in the UI. */
  role: TSlotRole;
  /** The offending factual token (e.g. `"325 mg"`). */
  token: string;
}

/** The verify step's report for one slide. `ok` means every factual token grounded. */
export interface IGroundingReport {
  ok: boolean;
  issues: Array<IGroundingIssue>;
}

/**
 * A slide element/slide whose content is narrowed to the serializable {@link TWireContent}
 * subset (no open `Record<string, unknown>`), so it can cross the server-function streaming
 * boundary. Structurally a subtype of {@link ISlideElement}/{@link ISlide} — the fill only ever
 * produces these shapes anyway — so the renderer, editor, and DB consume them as plain slides.
 */
export interface IWireSlideElement extends Omit<ISlideElement, "content"> {
  content: TWireContent;
}
export interface IWireSlide extends Omit<ISlide, "elements"> {
  elements: Array<IWireSlideElement>;
}

/** Client → server input: which stored content document to draw from, and the chat prompt. */
export const GenerateDeckInputSchema = z.object({
  contentDocId: z.string().uuid(),
  prompt: z.string().min(1).max(2000),
});
export type TGenerateDeckInput = z.input<typeof GenerateDeckInputSchema>;
export type TGenerateDeckData = z.output<typeof GenerateDeckInputSchema>;

/**
 * The streamed generation protocol. The server function yields these in order:
 *   `plan`  once (deck row created, N slides coming) → client renders N placeholders;
 *   `slide` per finished+verified+persisted slide     → placeholder i becomes the real slide;
 *   `error` for a per-slide failure (deck continues) or a fatal one (then no more events);
 *   `done`  once at the end.
 * Every payload is plain JSON so it serializes across the server-fn boundary.
 */
export type TGenerationEvent =
  | { type: "plan"; deckId: string; plan: TSlidePlan }
  | {
      type: "slide";
      index: number;
      slide: IWireSlide;
      grounding: IGroundingReport;
    }
  | { type: "error"; message: string; index?: number }
  | { type: "done"; deckId: string; slideCount: number };

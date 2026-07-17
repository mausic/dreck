import { z } from "zod";
import type {
  ISlide,
  ISlideElement,
  ITokens,
  TSlotRole,
} from "@/lib/slides/types";
import type { TWireContent } from "@/lib/ai/content-patch";
import { zContentPatch } from "@/lib/ai/content-patch";
import { SLOT_ROLES } from "@/lib/slides/types";

export const MAX_SLIDES = 8;

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

export const SlidePlanSchema = z.object({
  slides: z.array(SlidePlanItemSchema).min(1).max(MAX_SLIDES),
});
export type TSlidePlan = z.infer<typeof SlidePlanSchema>;

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

export interface IGroundingIssue {
  /** The slide element the token was found on. */
  elementId: string;
  /** The element's role, for surfacing the flag in the UI. */
  role: TSlotRole;
  /** The offending factual token (e.g. `"325 mg"`). */
  token: string;
}

export interface IGroundingReport {
  ok: boolean;
  issues: Array<IGroundingIssue>;
}

export const GroundingReportSchema = z.object({
  ok: z.boolean(),
  issues: z.array(
    z.object({
      elementId: z.string(),
      role: z.enum(SLOT_ROLES),
      token: z.string(),
    }),
  ),
}) satisfies z.ZodType<IGroundingReport>;

export interface IWireSlideElement extends Omit<ISlideElement, "content"> {
  content: TWireContent;
}
export interface IWireSlide extends Omit<ISlide, "elements"> {
  elements: Array<IWireSlideElement>;
}

export const GenerateDeckInputSchema = z.object({
  contentDocId: z.string().uuid(),
  prompt: z.string().min(1).max(2000),
  designDocId: z.string().uuid().optional(),
});
export type TGenerateDeckInput = z.input<typeof GenerateDeckInputSchema>;
export type TGenerateDeckData = z.output<typeof GenerateDeckInputSchema>;

export type TGenerationEvent =
  | {
      type: "plan";
      deckId: string;
      plan: TSlidePlan;
      tokens: ITokens;
      warning?: string;
    }
  | {
      type: "slide";
      index: number;
      slide: IWireSlide;
      grounding: IGroundingReport;
    }
  | { type: "error"; message: string; index?: number }
  | {
      type: "done";
      deckId: string;
      expectedSlideCount: number;
      generatedSlideCount: number;
      failedIndices: Array<number>;
      status: "complete" | "partial" | "failed";
    };

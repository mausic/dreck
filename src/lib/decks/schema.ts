import { z } from "zod";

import type { IWireSlide } from "@/lib/generate/schema";
import { GroundingReportSchema } from "@/lib/generate/schema";
import { SlideSchema } from "@/lib/slides/slide-schema";
import { TokensSchema } from "@/lib/slides/tokens";

export const DeckStatusSchema = z.enum([
  "generating",
  "complete",
  "partial",
  "failed",
]);

export const DeckListItemSchema = z.object({
  id: z.uuid(),
  prompt: z.string(),
  status: DeckStatusSchema,
  contentSourceName: z.string(),
  expectedSlideCount: z.number().int().nonnegative(),
  generatedSlideCount: z.number().int().nonnegative(),
  error: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type TDeckListItem = z.infer<typeof DeckListItemSchema>;

export const StoredDeckSchema = DeckListItemSchema.extend({
  tokens: TokensSchema,
  slides: z.array(
    z.object({
      index: z.number().int().nonnegative(),
      revision: z.number().int().nonnegative(),
      slide: SlideSchema,
      grounding: GroundingReportSchema,
    }),
  ),
});

export type TStoredDeck = z.infer<typeof StoredDeckSchema>;

export type TStoredDeckView = Omit<TStoredDeck, "slides"> & {
  slides: Array<{
    index: number;
    revision: number;
    slide: IWireSlide;
    grounding: z.infer<typeof GroundingReportSchema>;
  }>;
};

import { eq } from "drizzle-orm";

import type { IGroundingReport, TSlidePlan } from "@/lib/generate/schema";
import type { ISlide, ITokens } from "@/lib/slides/types";
import type { TDeckStatus } from "@/db/schema";
import type { getDb } from "@/db/client";
import { decks, slides } from "@/db/schema";
import { GroundingReportSchema, SlidePlanSchema } from "@/lib/generate/schema";
import { SlideSchema } from "@/lib/slides/slide-schema";
import { TokensSchema } from "@/lib/slides/tokens";

type TDb = ReturnType<typeof getDb>;

export async function createDeck(
  db: TDb,
  data: {
    contentDocId: string;
    designDocId?: string;
    prompt: string;
    plan: TSlidePlan;
    tokens: ITokens;
  },
): Promise<string> {
  const plan = SlidePlanSchema.parse(data.plan);
  const tokens = TokensSchema.parse(data.tokens);
  const rows = await db
    .insert(decks)
    .values({
      contentDocId: data.contentDocId,
      designDocId: data.designDocId,
      prompt: data.prompt,
      plan,
      designTokens: tokens,
      expectedSlideCount: plan.slides.length,
    })
    .returning({ id: decks.id });

  const row = rows.at(0);
  if (!row) throw new Error("The deck could not be created.");
  return row.id;
}

export async function persistSlide(
  db: TDb,
  data: {
    deckId: string;
    index: number;
    slide: ISlide;
    grounding: IGroundingReport;
  },
): Promise<void> {
  const slide = SlideSchema.parse(data.slide);
  await db.insert(slides).values({
    deckId: data.deckId,
    slideId: slide.id,
    index: data.index,
    archetypeId: slide.archetypeId,
    slide,
    grounding: GroundingReportSchema.parse(data.grounding),
  });
}

export async function finishDeckGeneration(
  db: TDb,
  data: {
    deckId: string;
    generatedSlideCount: number;
    expectedSlideCount: number;
    error?: string;
  },
): Promise<Exclude<TDeckStatus, "generating">> {
  const status: Exclude<TDeckStatus, "generating"> =
    data.generatedSlideCount === data.expectedSlideCount
      ? "complete"
      : data.generatedSlideCount > 0
        ? "partial"
        : "failed";

  await db
    .update(decks)
    .set({
      status,
      generatedSlideCount: data.generatedSlideCount,
      error: data.error,
    })
    .where(eq(decks.id, data.deckId));

  return status;
}

import { and, eq } from "drizzle-orm";

import type { IGroundingReport } from "@/lib/generate/schema";
import type { ISlide, ITokens } from "@/lib/slides/types";
import type { getDb } from "@/db/client";
import { decks, documents, slides } from "@/db/schema";
import { GroundingReportSchema } from "@/lib/generate/schema";
import { SlideSchema } from "@/lib/slides/slide-schema";
import { TokensSchema } from "@/lib/slides/tokens";

type TDb = ReturnType<typeof getDb>;

export interface ISlideEditContext {
  slide: ISlide;
  revision: number;
  grounding: IGroundingReport;
  tokens: ITokens;
  sourceMarkdown: string;
}

export async function loadSlideForEdit(
  db: TDb,
  deckId: string,
  slideId: string,
): Promise<ISlideEditContext> {
  const rows = await db
    .select({
      slide: slides.slide,
      revision: slides.revision,
      grounding: slides.grounding,
      tokens: decks.designTokens,
      sourceMarkdown: documents.markdown,
    })
    .from(slides)
    .innerJoin(decks, eq(slides.deckId, decks.id))
    .innerJoin(documents, eq(decks.contentDocId, documents.id))
    .where(and(eq(slides.deckId, deckId), eq(slides.slideId, slideId)))
    .limit(1);

  const row = rows.at(0);
  if (!row) throw new Error("The selected slide was not found.");
  return {
    slide: SlideSchema.parse(row.slide),
    revision: row.revision,
    grounding: GroundingReportSchema.parse(
      row.grounding ?? { ok: true, issues: [] },
    ),
    tokens: TokensSchema.parse(row.tokens),
    sourceMarkdown: row.sourceMarkdown,
  };
}

export async function updateSlideAfterEdit(
  db: TDb,
  data: {
    deckId: string;
    slideId: string;
    expectedRevision: number;
    slide: ISlide;
    grounding: IGroundingReport;
  },
): Promise<number | null> {
  const nextRevision = data.expectedRevision + 1;
  const rows = await db
    .update(slides)
    .set({
      slide: SlideSchema.parse(data.slide),
      grounding: GroundingReportSchema.parse(data.grounding),
      revision: nextRevision,
    })
    .where(
      and(
        eq(slides.deckId, data.deckId),
        eq(slides.slideId, data.slideId),
        eq(slides.revision, data.expectedRevision),
      ),
    )
    .returning({ revision: slides.revision });

  return rows.at(0)?.revision ?? null;
}

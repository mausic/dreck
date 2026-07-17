import { and, desc, eq } from "drizzle-orm";

import type { ISection } from "@/lib/extract/section";
import type { IExtractedArchetype, ITokens } from "@/lib/slides/types";
import type { getDb } from "@/db/client";
import { documents } from "@/db/schema";
import { SectionTreeSchema } from "@/lib/extract/section";
import { ExtractedArchetypesSchema } from "@/lib/slides/archetype-schema";
import { DESIGN_TOKENS, TokensSchema } from "@/lib/slides/tokens";

type TDb = ReturnType<typeof getDb>;

export interface IDeckDesign {
  tokens: ITokens;
  archetypes: Array<IExtractedArchetype> | null;
}

export async function persistContentDocument(
  db: TDb,
  data: { sourceName: string; markdown: string; sections: Array<ISection> },
): Promise<string> {
  const rows = await db
    .insert(documents)
    .values({
      role: "content",
      sourceName: data.sourceName,
      markdown: data.markdown,
      sections: SectionTreeSchema.parse(data.sections),
    })
    .returning({ id: documents.id });
  const row = rows.at(0);
  if (!row) throw new Error("The content document could not be saved.");
  return row.id;
}

export async function persistDesignDocument(
  db: TDb,
  data: {
    sourceName: string;
    tokens: ITokens;
    feel: string;
    archetypes: Array<IExtractedArchetype>;
  },
): Promise<string> {
  const rows = await db
    .insert(documents)
    .values({
      role: "design",
      sourceName: data.sourceName,
      markdown: "",
      sections: [],
      designTokens: TokensSchema.parse(data.tokens),
      designFeel: data.feel,
      designArchetypes: ExtractedArchetypesSchema.parse(data.archetypes),
    })
    .returning({ id: documents.id });
  const row = rows.at(0);
  if (!row) throw new Error("The design document could not be saved.");
  return row.id;
}

export async function loadContentDocument(
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

  const row = rows.at(0);
  if (!row) {
    throw new Error("Content document not found. Extract a content PDF first.");
  }
  if (row.role !== "content") {
    throw new Error("Selected document is a design PDF, not content.");
  }

  return {
    markdown: row.markdown,
    sections: SectionTreeSchema.parse(row.sections),
  };
}

export async function loadDeckDesign(
  db: TDb,
  designDocId: string | undefined,
): Promise<IDeckDesign> {
  if (!designDocId) {
    return { tokens: DESIGN_TOKENS, archetypes: null };
  }

  const rows = await db
    .select({
      role: documents.role,
      designTokens: documents.designTokens,
      designArchetypes: documents.designArchetypes,
    })
    .from(documents)
    .where(eq(documents.id, designDocId))
    .limit(1);

  const row = rows.at(0);
  if (!row) throw new Error("Selected design document was not found.");
  if (row.role !== "design") {
    throw new Error("Selected document is a content PDF, not a design.");
  }
  if (!row.designTokens) {
    throw new Error("Selected design document has no extracted design system.");
  }

  return {
    tokens: TokensSchema.parse(row.designTokens),
    archetypes: row.designArchetypes
      ? ExtractedArchetypesSchema.parse(row.designArchetypes)
      : null,
  };
}

export async function listContentDocuments(db: TDb) {
  return db
    .select({ id: documents.id, sourceName: documents.sourceName })
    .from(documents)
    .where(eq(documents.role, "content"))
    .orderBy(desc(documents.createdAt))
    .limit(20);
}

export async function listDesignDocuments(db: TDb) {
  const rows = await db
    .select({
      id: documents.id,
      sourceName: documents.sourceName,
      designTokens: documents.designTokens,
      designFeel: documents.designFeel,
      designArchetypes: documents.designArchetypes,
    })
    .from(documents)
    .where(eq(documents.role, "design"))
    .orderBy(desc(documents.createdAt));

  return rows.flatMap((row) => {
    const tokens = TokensSchema.safeParse(row.designTokens);
    const archetypes = row.designArchetypes
      ? ExtractedArchetypesSchema.safeParse(row.designArchetypes)
      : null;
    if (!tokens.success || (archetypes && !archetypes.success)) return [];
    return [
      {
        ...row,
        designTokens: tokens.data,
        designArchetypes: archetypes?.data ?? null,
      },
    ];
  });
}

export async function deleteDesignDocumentRecord(
  db: TDb,
  id: string,
): Promise<boolean> {
  const rows = await db
    .delete(documents)
    .where(and(eq(documents.id, id), eq(documents.role, "design")))
    .returning({ id: documents.id });
  return rows.length > 0;
}

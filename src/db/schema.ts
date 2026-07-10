/**
 * Drizzle schema. One table for now: uploaded source documents and their extraction.
 *
 * `markdown` is the verbatim OCR output — the durable source of truth a later grounding
 * step verifies generated slides against, so it is kept exactly as returned. `sections`
 * is the generic tree from `parseSections`, stored as typed jsonb (`.$type<…>()`) — strict
 * shape, open string vocabulary, never an untyped blob. `role` is the one closed set
 * (content vs design PDF), narrowed at the TS boundary without a Postgres enum migration.
 */
import { jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import type { ISection } from "@/lib/extract/section";

/** Which half of the two-PDF upload a document is: the content PDF or the design PDF. */
export type TDocumentRole = "content" | "design";

export const documents = pgTable("documents", {
  id: uuid("id").primaryKey().defaultRandom(),
  role: text("role").$type<TDocumentRole>().notNull(),
  sourceName: text("source_name").notNull(),
  markdown: text("markdown").notNull(),
  sections: jsonb("sections").$type<Array<ISection>>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export type TDocumentRow = typeof documents.$inferSelect;
export type TNewDocument = typeof documents.$inferInsert;

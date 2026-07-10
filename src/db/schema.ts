/**
 * Drizzle schema. Two concerns: uploaded source documents and their extraction
 * (`documents`), and the decks generated from them (`decks` + `slides`).
 *
 * `markdown` is the verbatim OCR output — the durable source of truth the grounding step
 * verifies generated slides against, so it is kept exactly as returned. `sections` is the
 * generic tree from `parseSections`, stored as typed jsonb (`.$type<…>()`) — strict shape,
 * open string vocabulary, never an untyped blob. `role` is the one closed set (content vs
 * design PDF), narrowed at the TS boundary without a Postgres enum migration.
 *
 * A generated `slide` is stored as the whole flat {@link ISlide} jsonb (elements embedded,
 * matching how the renderer/editor consume it — no separate elements table). Grounding flags
 * ride in a sibling column, never inside the slide model, so the model stays unchanged.
 */
import {
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import type { ISection } from "@/lib/extract/section";
import type { ISlide } from "@/lib/slides/types";
import type { IGroundingReport, TSlidePlan } from "@/lib/ai/generate-schema";

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

/**
 * A generated deck: the user's chat prompt, the content document it drew from, and the
 * planner's {@link TSlidePlan} (kept so a deck's slide count/coverage stays attributable to
 * the plan that produced it). Slides hang off this row.
 */
export const decks = pgTable("decks", {
  id: uuid("id").primaryKey().defaultRandom(),
  contentDocId: uuid("content_doc_id")
    .references(() => documents.id)
    .notNull(),
  prompt: text("prompt").notNull(),
  plan: jsonb("plan").$type<TSlidePlan>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export type TDeckRow = typeof decks.$inferSelect;
export type TNewDeck = typeof decks.$inferInsert;

/**
 * One generated slide. `slide` is the full flat {@link ISlide} (elements embedded) so it
 * renders/edits through the existing pipeline unchanged; `grounding` holds the verify step's
 * report (out-of-band flags), `index` fixes deck order.
 */
export const slides = pgTable("slides", {
  id: uuid("id").primaryKey().defaultRandom(),
  deckId: uuid("deck_id")
    .references(() => decks.id)
    .notNull(),
  index: integer("index").notNull(),
  archetypeId: text("archetype_id").notNull(),
  slide: jsonb("slide").$type<ISlide>().notNull(),
  grounding: jsonb("grounding").$type<IGroundingReport>(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export type TSlideRow = typeof slides.$inferSelect;
export type TNewSlide = typeof slides.$inferInsert;

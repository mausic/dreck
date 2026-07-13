import {
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import type { ISection } from "@/lib/extract/section";
import type { ISlide, ITokens } from "@/lib/slides/types";
import type { IGroundingReport, TSlidePlan } from "@/lib/ai/generate-schema";

/** Which half of the two-PDF upload a document is: the content PDF or the design PDF. */
export type TDocumentRole = "content" | "design";

export const documents = pgTable("documents", {
  id: uuid("id").primaryKey().defaultRandom(),
  role: text("role").$type<TDocumentRole>().notNull(),
  sourceName: text("source_name").notNull(),
  markdown: text("markdown").notNull(),
  sections: jsonb("sections").$type<Array<ISection>>().notNull(),
  // Design-system extraction, cached per design PDF (only set for `role: 'design'`): the extracted
  // Tokens (the design system) + a short qualitative feel note. Nullable — content docs never have
  // them, and generation reads these back instead of re-extracting on every deck.
  designTokens: jsonb("design_tokens").$type<ITokens>(),
  designFeel: text("design_feel"),
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

import {
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import type { ISection } from "@/lib/extract/section";
import type { IExtractedArchetype, ISlide, ITokens } from "@/lib/slides/types";
import type { IGroundingReport, TSlidePlan } from "#/lib/generate/schema";

export const documentRoleEnum = pgEnum("document_role", ["content", "design"]);
export type TDocumentRole = (typeof documentRoleEnum.enumValues)[number];

export const deckStatusEnum = pgEnum("deck_status", [
  "generating",
  "complete",
  "partial",
  "failed",
]);
export type TDeckStatus = (typeof deckStatusEnum.enumValues)[number];

export const documents = pgTable(
  "documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    role: documentRoleEnum("role").notNull(),
    sourceName: text("source_name").notNull(),
    markdown: text("markdown").notNull(),
    sections: jsonb("sections").$type<Array<ISection>>().notNull(),
    designTokens: jsonb("design_tokens").$type<ITokens>(),
    designFeel: text("design_feel"),
    designArchetypes:
      jsonb("design_archetypes").$type<Array<IExtractedArchetype>>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("documents_role_created_at_idx").on(table.role, table.createdAt),
  ],
);

export type TDocumentRow = typeof documents.$inferSelect;
export type TNewDocument = typeof documents.$inferInsert;

export const decks = pgTable(
  "decks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    contentDocId: uuid("content_doc_id")
      .references(() => documents.id, { onDelete: "restrict" })
      .notNull(),
    designDocId: uuid("design_doc_id").references(() => documents.id, {
      onDelete: "set null",
    }),
    prompt: text("prompt").notNull(),
    plan: jsonb("plan").$type<TSlidePlan>().notNull(),
    designTokens: jsonb("design_tokens").$type<ITokens>().notNull(),
    status: deckStatusEnum("status").default("generating").notNull(),
    expectedSlideCount: integer("expected_slide_count").notNull(),
    generatedSlideCount: integer("generated_slide_count").default(0).notNull(),
    error: text("error"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("decks_content_doc_id_idx").on(table.contentDocId),
    index("decks_design_doc_id_idx").on(table.designDocId),
  ],
);

export type TDeckRow = typeof decks.$inferSelect;
export type TNewDeck = typeof decks.$inferInsert;

export const slides = pgTable(
  "slides",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    deckId: uuid("deck_id")
      .references(() => decks.id, { onDelete: "cascade" })
      .notNull(),
    slideId: text("slide_id").notNull(),
    index: integer("index").notNull(),
    archetypeId: text("archetype_id").notNull(),
    slide: jsonb("slide").$type<ISlide>().notNull(),
    grounding: jsonb("grounding").$type<IGroundingReport>(),
    revision: integer("revision").default(0).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("slides_deck_index_unique").on(table.deckId, table.index),
    uniqueIndex("slides_deck_slide_id_unique").on(table.deckId, table.slideId),
  ],
);

export type TSlideRow = typeof slides.$inferSelect;
export type TNewSlide = typeof slides.$inferInsert;

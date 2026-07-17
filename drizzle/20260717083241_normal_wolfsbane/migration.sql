CREATE TYPE "deck_status" AS ENUM('generating', 'complete', 'partial', 'failed');--> statement-breakpoint
CREATE TYPE "document_role" AS ENUM('content', 'design');--> statement-breakpoint
CREATE TABLE "decks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"content_doc_id" uuid NOT NULL,
	"design_doc_id" uuid,
	"prompt" text NOT NULL,
	"plan" jsonb NOT NULL,
	"design_tokens" jsonb NOT NULL,
	"status" "deck_status" DEFAULT 'generating'::"deck_status" NOT NULL,
	"expected_slide_count" integer NOT NULL,
	"generated_slide_count" integer DEFAULT 0 NOT NULL,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"role" "document_role" NOT NULL,
	"source_name" text NOT NULL,
	"markdown" text NOT NULL,
	"sections" jsonb NOT NULL,
	"design_tokens" jsonb,
	"design_feel" text,
	"design_archetypes" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "slides" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"deck_id" uuid NOT NULL,
	"slide_id" text NOT NULL,
	"index" integer NOT NULL,
	"archetype_id" text NOT NULL,
	"slide" jsonb NOT NULL,
	"grounding" jsonb,
	"revision" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "decks_content_doc_id_idx" ON "decks" ("content_doc_id");--> statement-breakpoint
CREATE INDEX "decks_design_doc_id_idx" ON "decks" ("design_doc_id");--> statement-breakpoint
CREATE INDEX "documents_role_created_at_idx" ON "documents" ("role","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "slides_deck_index_unique" ON "slides" ("deck_id","index");--> statement-breakpoint
CREATE UNIQUE INDEX "slides_deck_slide_id_unique" ON "slides" ("deck_id","slide_id");--> statement-breakpoint
ALTER TABLE "decks" ADD CONSTRAINT "decks_content_doc_id_documents_id_fkey" FOREIGN KEY ("content_doc_id") REFERENCES "documents"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "decks" ADD CONSTRAINT "decks_design_doc_id_documents_id_fkey" FOREIGN KEY ("design_doc_id") REFERENCES "documents"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "slides" ADD CONSTRAINT "slides_deck_id_decks_id_fkey" FOREIGN KEY ("deck_id") REFERENCES "decks"("id") ON DELETE CASCADE;
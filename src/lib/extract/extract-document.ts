/**
 * `extractDocument` — the TanStack Start server function behind Task 4's two stages.
 *
 * Stage 1: PDF (base64) → faithful markdown via the Mistral doc API (`pdfToMarkdown`).
 * Stage 2: markdown → generic section tree, deterministically (`parseSections`).
 * Then persist both to `documents` (markdown as the source of truth) and echo them back.
 *
 * The provider/DB keys stay server-side. The handler never throws to the client: a missing
 * key, an OCR failure, or a DB error all resolve to `{ ok: false }`. Because this backs a
 * debug view, the real error message is surfaced rather than a generic one.
 */
import { createServerFn } from "@tanstack/react-start";
import type {
  TExtractDocumentInput,
  TExtractDocumentResult,
} from "@/lib/extract/extract-schema";
import { getDb } from "@/db/client";
import { documents } from "@/db/schema";
import { pdfToMarkdown } from "@/lib/extract/mistral";
import { parseSections } from "@/lib/extract/parse-markdown";
import { ExtractDocumentInputSchema } from "@/lib/extract/extract-schema";

export const extractDocument = createServerFn({ method: "POST" })
  .validator((input: TExtractDocumentInput) =>
    ExtractDocumentInputSchema.parse(input),
  )
  .handler(async ({ data }): Promise<TExtractDocumentResult> => {
    try {
      // Stage 1 — table-aware markdown, kept verbatim as the source of truth.
      const markdown = await pdfToMarkdown(data.pdfBase64);
      // Stage 2 — deterministic, faithful section tree (no LLM rewriting).
      const sections = parseSections(markdown);

      const db = getDb();
      const [row] = await db
        .insert(documents)
        .values({
          role: data.role,
          sourceName: data.sourceName,
          markdown,
          sections,
        })
        .returning({ id: documents.id });

      return {
        ok: true,
        id: row.id,
        role: data.role,
        sourceName: data.sourceName,
        markdown,
        sections,
      };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : "Extraction failed.",
      };
    }
  });

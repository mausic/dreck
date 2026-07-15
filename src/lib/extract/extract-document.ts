/**
 * `extractDocument` — the TanStack Start server function behind extraction, branching by role.
 *
 * CONTENT PDF (the reference): Stage 1 — PDF → faithful markdown via the Mistral doc API
 * (`pdfToMarkdown`); Stage 2 — markdown → generic section tree deterministically (`parseSections`).
 * Both persist to `documents` (markdown as the durable source of truth) and echo back.
 *
 * DESIGN PDF (the style template): no OCR — its words are discarded. Instead `extractDesignSystem`
 * derives design tokens plus representative layout archetypes and caches them on the row, so
 * generation reads the complete design system back without re-extracting.
 *
 * The provider/DB keys stay server-side. The handler never throws to the client: a missing key, an
 * OCR/extraction failure, or a DB error all resolve to `{ ok: false }`. Because this backs a debug
 * view, the real error message is surfaced rather than a generic one.
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
import { extractDesignSystem } from "@/lib/extract/design-system";
import { ExtractDocumentInputSchema } from "@/lib/extract/extract-schema";

/** Decode a base64 payload (no `data:` prefix) to bytes. `atob` is available on Workers. */
function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export const extractDocument = createServerFn({ method: "POST" })
  .validator((input: TExtractDocumentInput) =>
    ExtractDocumentInputSchema.parse(input),
  )
  .handler(async ({ data }): Promise<TExtractDocumentResult> => {
    try {
      const db = getDb();

      if (data.role === "design") {
        // Design deck → tokens + layout skeletons. No OCR: source words are never persisted or used.
        const { tokens, feel, archetypes } = await extractDesignSystem(
          base64ToBytes(data.pdfBase64),
        );
        const [row] = await db
          .insert(documents)
          .values({
            role: "design",
            sourceName: data.sourceName,
            markdown: "",
            sections: [],
            designTokens: tokens,
            designFeel: feel,
            designArchetypes: archetypes,
          })
          .returning({ id: documents.id });

        return {
          ok: true,
          id: row.id,
          role: "design",
          sourceName: data.sourceName,
          markdown: "",
          sections: [],
          designTokens: tokens,
          designFeel: feel,
          designArchetypes: archetypes,
        };
      }

      // Content deck → table-aware markdown (source of truth) + deterministic section tree.
      const markdown = await pdfToMarkdown(data.pdfBase64);
      const sections = parseSections(markdown);
      const [row] = await db
        .insert(documents)
        .values({
          role: "content",
          sourceName: data.sourceName,
          markdown,
          sections,
        })
        .returning({ id: documents.id });

      return {
        ok: true,
        id: row.id,
        role: "content",
        sourceName: data.sourceName,
        markdown,
        sections,
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Extraction failed.";
      return {
        ok: false,
        error: `${data.role === "design" ? "Design" : "Content"} extraction failed; nothing was saved. ${message}`,
      };
    }
  });

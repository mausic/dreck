import { createServerFn } from "@tanstack/react-start";
import type {
  TExtractDocumentInput,
  TExtractDocumentResult,
} from "@/lib/extract/extract-schema";
import { getDb } from "@/db/client";
import {
  persistContentDocument,
  persistDesignDocument,
} from "@/db/queries/documents.server";
import { pdfToMarkdown } from "@/lib/extract/mistral";
import { parseSections } from "@/lib/extract/parse-markdown";
import { extractDesignSystem } from "@/lib/extract/design-system";
import { ExtractDocumentInputSchema } from "@/lib/extract/extract-schema";

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function validatePdf(bytes: Uint8Array): void {
  // TODO: replace magic-number check with a .env configurable max size
  if (bytes.byteLength > 15_000_000) {
    throw new Error("PDF exceeds the 15 MB upload limit.");
  }
  const signature = String.fromCharCode(...bytes.subarray(0, 5));
  if (signature !== "%PDF-")
    throw new Error("Uploaded file is not a valid PDF.");
}

export const extractDocument = createServerFn({ method: "POST" })
  .validator((input: TExtractDocumentInput) =>
    ExtractDocumentInputSchema.parse(input),
  )
  .handler(async ({ data }): Promise<TExtractDocumentResult> => {
    try {
      const db = getDb();
      const pdfBytes = base64ToBytes(data.pdfBase64);
      validatePdf(pdfBytes);

      if (data.role === "design") {
        const { tokens, feel, archetypes } =
          await extractDesignSystem(pdfBytes);
        const id = await persistDesignDocument(db, {
          sourceName: data.sourceName,
          tokens,
          feel,
          archetypes,
        });

        return {
          ok: true,
          id,
          role: "design",
          sourceName: data.sourceName,
          markdown: "",
          sections: [],
          designTokens: tokens,
          designFeel: feel,
          designArchetypes: archetypes,
        };
      }

      const markdown = await pdfToMarkdown(data.pdfBase64);
      const sections = parseSections(markdown);
      const id = await persistContentDocument(db, {
        sourceName: data.sourceName,
        markdown,
        sections,
      });

      return {
        ok: true,
        id,
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

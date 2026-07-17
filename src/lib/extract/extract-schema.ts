import { z } from "zod";
import type { ISection } from "@/lib/extract/section";
import type { IExtractedArchetype, ITokens } from "@/lib/slides/types";

export const MAX_PDF_BYTES = 15_000_000;
export const MAX_PDF_BASE64_LENGTH = Math.ceil((MAX_PDF_BYTES * 4) / 3) + 4;

export const ExtractDocumentInputSchema = z.object({
  role: z.enum(["content", "design"]),
  sourceName: z.string().min(1).max(255),
  // TODO: replace magic-number check with a .env configurable max size
  pdfBase64: z.string().min(1).max(MAX_PDF_BASE64_LENGTH),
});

export type TExtractDocumentInput = z.input<typeof ExtractDocumentInputSchema>;
export type TExtractDocumentData = z.output<typeof ExtractDocumentInputSchema>;

/** The stored document echoed back for inspection. */
export interface IExtractedDocument {
  id: string;
  role: "content" | "design";
  sourceName: string;
  markdown: string;
  sections: Array<ISection>;
  designTokens?: ITokens;
  designFeel?: string;
  designArchetypes?: Array<IExtractedArchetype>;
}

export type TExtractDocumentResult =
  ({ ok: true } & IExtractedDocument) | { ok: false; error: string };

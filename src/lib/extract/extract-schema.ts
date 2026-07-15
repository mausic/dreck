/**
 * The wire contract for document extraction.
 *
 * The client reads the uploaded PDF to base64 and sends it (there is no model generating
 * against this schema, so a plain typed payload is enough — unlike the edit flow's tagged
 * union). The server returns a discriminated result, never a throw, so the debug view can
 * distinguish a stored document from a soft failure (missing key, OCR error, DB down).
 */
import { z } from "zod";
import type { ISection } from "@/lib/extract/section";
import type { IExtractedArchetype, ITokens } from "@/lib/slides/types";

/** Client → server payload: which PDF, its filename, and its bytes as base64 (no `data:` prefix). */
export const ExtractDocumentInputSchema = z.object({
  role: z.enum(["content", "design"]),
  sourceName: z.string().min(1).max(255),
  // ~15 MB decoded ≈ 20M base64 chars — a generous guard for a single-user prototype.
  pdfBase64: z.string().min(1).max(20_000_000),
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
  /** Present only for a `design` document: the extracted design system + feel note. */
  designTokens?: ITokens;
  designFeel?: string;
  designArchetypes?: Array<IExtractedArchetype>;
}

/** Server → client result. `ok: false` leaves nothing persisted. */
export type TExtractDocumentResult =
  ({ ok: true } & IExtractedDocument) | { ok: false; error: string };

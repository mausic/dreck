/**
 * Stage 1 of extraction: PDF → faithful, table-aware markdown via the Mistral Document
 * (OCR) API. Server-only — the key is read from env here and never reaches the client.
 *
 * Why the dedicated OCR endpoint (`mistral-ocr-latest`) and not the AI SDK: the SDK only
 * exposes Mistral OCR as a chat model reading a PDF, which can paraphrase; the `/v1/ocr`
 * endpoint is purpose-built and returns verbatim per-page markdown — critical because this
 * markdown is the durable source of truth a later grounding step checks slides against.
 * Naive `pdftotext`/`unpdf` is out too: it scrambles tables (weight bands drift from doses);
 * the doc model keeps tables as GitHub-flavoured markdown so row↔value links survive.
 *
 * Transport is a plain `fetch` (no SDK): fewer deps and it runs natively on Workers. The
 * PDF is sent inline as a base64 `data:` URL — for a single-user prototype this skips the
 * Files-upload + signed-URL round-trip. The response is parsed defensively so a shape
 * change surfaces as a clear error instead of a silent `undefined`.
 */
import { z } from "zod";

const OCR_ENDPOINT = "https://api.mistral.ai/v1/ocr";
const DEFAULT_OCR_MODEL = "mistral-ocr-latest";

/** Thrown when the Mistral key is absent; the server function turns it into a soft error. */
export class MissingMistralKeyError extends Error {
  constructor() {
    super("MISTRAL_API_KEY is not set");
    this.name = "MissingMistralKeyError";
  }
}

/** Thrown when the OCR call fails (non-2xx) or returns an unexpected shape. */
export class MistralOcrError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MistralOcrError";
  }
}

/** Only the fields we consume; extra keys in Mistral's payload are ignored. */
const OcrResponseSchema = z.object({
  pages: z
    .array(z.object({ index: z.number().optional(), markdown: z.string() }))
    .min(1),
});

/**
 * Send a base64-encoded PDF to the OCR API and return its pages joined into one markdown
 * document (the durable source of truth). Pages are joined verbatim with a blank line — no
 * injected "Page N" headings, which would pollute the section tree parsed downstream.
 *
 * @param pdfBase64 the PDF bytes, base64-encoded WITHOUT a `data:` prefix.
 */
export async function pdfToMarkdown(pdfBase64: string): Promise<string> {
  const apiKey = process.env.MISTRAL_API_KEY;
  if (!apiKey) throw new MissingMistralKeyError();

  const model = process.env.MISTRAL_OCR_MODEL ?? DEFAULT_OCR_MODEL;

  const response = await fetch(OCR_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      document: {
        type: "document_url",
        document_url: `data:application/pdf;base64,${pdfBase64}`,
      },
      include_image_base64: false,
    }),
  });

  if (!response.ok) {
    const detail = (await response.text()).slice(0, 500);
    throw new MistralOcrError(
      `OCR request failed (${response.status}): ${detail}`,
    );
  }

  const parsed = OcrResponseSchema.safeParse(await response.json());
  if (!parsed.success) {
    throw new MistralOcrError("OCR response did not match the expected shape.");
  }

  return parsed.data.pages.map((page) => page.markdown).join("\n\n");
}

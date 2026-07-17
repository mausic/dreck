import { z } from "zod";
import { getConfig } from "@/lib/config";

const OCR_ENDPOINT = "https://api.mistral.ai/v1/ocr";

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
  const config = getConfig();

  const model = config.MISTRAL_OCR_MODEL;

  const response = await fetch(OCR_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.MISTRAL_API_KEY}`,
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

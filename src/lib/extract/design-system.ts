/**
 * Design-system extraction: a design PDF → the {@link ITokens} the renderer/generation consume.
 *
 * HYBRID, not all-VLM (spec §6):
 *   • Fonts are DETERMINISTIC — {@link extractFonts} reads the PDF's font info (no model).
 *   • Colors + feel are the MODEL PASS — server-side rasterization is impractical on Workers (no
 *     canvas/pdfium) and every content stream is Flate-compressed, so we take the sanctioned VLM
 *     fallback: the model reads the PDF directly (as a `file` part — no rasterizing) and reports the
 *     palette assigned to ROLE-based token names (not hue names) plus a short qualitative feel note.
 *
 * The result is assembled as `{ colors: <model>, fonts: <deterministic> }` and validated against the
 * existing {@link TokensSchema}, so it is a drop-in for the hardcoded tokens. Fonts are stitched in
 * AFTER the model call, so the model can never override them — the deterministic guarantee holds.
 */
import { generateObject } from "ai";
import { z } from "zod";
import type { ITokens } from "@/lib/slides/types";
import { PHARMA_TOKENS, TokensSchema } from "@/lib/slides/tokens";
import { getDesignModel } from "@/lib/ai/model";
import { withModelRetry } from "@/lib/ai/retry";
import { extractFonts } from "@/lib/extract/fonts";

/** What the model returns: role-based colors (reusing the token color shape) + a feel note. */
const DesignModelSchema = z.object({
  colors: TokensSchema.shape.colors,
  feel: z
    .string()
    .describe(
      "One or two sentences on spacing rhythm and rule/eyebrow treatment.",
    ),
});

export interface IExtractedDesignSystem {
  tokens: ITokens;
  /** Qualitative feel note (spacing rhythm, rule/eyebrow treatment) — stored alongside the tokens. */
  feel: string;
}

const DESIGN_SYSTEM_PROMPT = `You are a brand designer reading a corporate presentation template (PDF) to capture its design system.

Report the deck's CORE palette as hex colors, each assigned to a ROLE (not a hue name):
- primary: the dominant brand color — the full-bleed title/background and callout panels (typically a deep, saturated color).
- surface: the light page background behind body slides.
- accent: the highlight color used for eyebrows, rules, and key figures.
- white: the lightest color used for text/shapes on the primary color (usually near-white).
- textDark: the near-black color used for body text on light surfaces.
- textMuted: the muted grey used for footers and captions.

Rules:
- Use the deck's ACTUAL colors as seen in the PDF — do not invent a palette or use generic brand colors.
- Every color MUST be a 6-digit hex string like "#0d3b5c".
- Also give a short "feel" note: spacing rhythm and how rules/eyebrows are treated.
- Do NOT report fonts — those are extracted separately.`;

function buildDesignPrompt(fonts: { display?: string; body?: string }): string {
  return `Extract the design system's color palette from the attached design deck.

For reference, its fonts were already extracted deterministically — display: ${fonts.display ?? "(unknown)"}; body: ${fonts.body ?? "(unknown)"}. Do not report fonts; only assign the colors to their roles and describe the feel.`;
}

/**
 * Extract the design system from a design PDF. Fonts deterministic, colors via the model reading the
 * PDF. Throws on a missing key / model failure — the caller (the extract server fn) soft-fails.
 */
export async function extractDesignSystem(
  pdfBytes: Uint8Array,
): Promise<IExtractedDesignSystem> {
  const fonts = extractFonts(pdfBytes);

  const { object } = await withModelRetry(() =>
    generateObject({
      model: getDesignModel(),
      schema: DesignModelSchema,
      system: DESIGN_SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: buildDesignPrompt(fonts) },
            { type: "file", data: pdfBytes, mediaType: "application/pdf" },
          ],
        },
      ],
      // Transient overloads handled by withModelRetry; no SDK-level 429 backoff.
      maxRetries: 0,
    }),
  );

  // Stitch deterministic fonts in AFTER the model call — it can never override them. Missing roles
  // (e.g. a font-less PDF) fall back to the placeholder tokens.
  const tokens: ITokens = {
    colors: object.colors,
    fonts: {
      display: fonts.display ?? PHARMA_TOKENS.fonts.display,
      body: fonts.body ?? PHARMA_TOKENS.fonts.body,
    },
  };

  return { tokens, feel: object.feel };
}

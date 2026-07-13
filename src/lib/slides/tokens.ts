import { z } from "zod";
import type { ITokens } from "@/lib/slides/types";

/**
 * Canonical Zod schema for {@link ITokens}. One definition consumed everywhere a Tokens object
 * is parsed — the region-edit tone cue and the design-system extraction output — so the extracted
 * design system provably matches the shape the renderer/editor/generation already consume.
 */
export const TokensSchema = z.object({
  colors: z.object({
    primary: z.string(),
    surface: z.string(),
    accent: z.string(),
    white: z.string(),
    textDark: z.string(),
    textMuted: z.string(),
  }),
  fonts: z.object({
    display: z.string(),
    body: z.string(),
  }),
}) satisfies z.ZodType<ITokens>;

/**
 * Default design tokens.
 */
export const DESIGN_TOKENS: ITokens = {
  colors: {
    primary: "#0d3b5c", // brand primary — title bg + callout panels (approx. deep navy)
    surface: "#f4f7f9", // light surface (approx. light grey)
    accent: "#1a6bb5", // accent — eyebrows, rules, figures (approx. blue)
    white: "#ffffff",
    textDark: "#132430", // near-black body text
    textMuted: "#5b7385", // muted grey — footers, captions
  },
  fonts: {
    display: '"Libre Franklin", "Geist Variable", system-ui, sans-serif',
    body: '"IBM Plex Sans", "Geist Variable", system-ui, sans-serif',
  },
};

import type { ITokens } from "@/lib/slides/types";

/**
 * Placeholder design tokens approximating a corporate pharma design system.
 *
 * approximate — replaced by real design-system extraction in a later task
 * (rasterize the design PDF → VLM, hybrid with deterministic fonts/colors).
 *
 * Fonts list the intended families first and fall back to system sans so the
 * prototype renders correctly without bundling the real webfonts yet.
 */
export const PHARMA_TOKENS: ITokens = {
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

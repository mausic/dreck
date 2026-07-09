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
    navy: "#0d3b5c", // deep corporate navy — title bg + callout panels
    panel: "#f4f7f9", // light-grey surface panel
    accent: "#1a6bb5", // accent blue — eyebrows, rules, figures
    white: "#ffffff",
    textDark: "#132430", // near-black body text
    textMuted: "#5b7385", // muted grey — footers, captions
  },
  fonts: {
    display: '"Libre Franklin", "Geist Variable", system-ui, sans-serif',
    body: '"IBM Plex Sans", "Geist Variable", system-ui, sans-serif',
  },
};

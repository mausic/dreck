import type { CSSProperties } from "react";

/**
 * Style resolution seam: maps a `styleRef` (opaque string on the model) to concrete
 * CSS. Presets reference `--slide-*` CSS custom properties that `SlidePreview` sets
 * from the active {@link import("./types").ITokens} — so swapping the tokens object
 * restyles every element without touching the model or these presets.
 */

/** Canonical styleRef keys. Shared by archetypes (skeleton) and the deck (content). */
export const STYLE_REF = {
  titleBg: "title/bg",
  titleLogo: "title/logo",
  titleEyebrow: "title/eyebrow",
  titleTitle: "title/title",
  titleRule: "title/rule",
  titleSubtitle: "title/subtitle",
  titleFooter: "title/footer",
  sidebarEyebrow: "sidebar/eyebrow",
  sidebarHeading: "sidebar/heading",
  sidebarRow: "sidebar/row",
  sidebarPanel: "sidebar/panel",
  sidebarFooter: "sidebar/footer",
} as const;

const STYLE_PRESETS: Record<string, CSSProperties> = {
  // — Title archetype (light text on a full-bleed primary stage) —
  [STYLE_REF.titleBg]: {
    background: "var(--slide-primary)",
  },
  [STYLE_REF.titleLogo]: {
    display: "flex",
    alignItems: "center",
    fontFamily: "var(--slide-font-display)",
    fontWeight: 700,
    fontSize: 26,
    letterSpacing: "0.01em",
    color: "var(--slide-white)",
  },
  [STYLE_REF.titleEyebrow]: {
    display: "flex",
    alignItems: "flex-end",
    fontFamily: "var(--slide-font-body)",
    fontWeight: 600,
    fontSize: 22,
    letterSpacing: "0.32em",
    textTransform: "uppercase",
    color: "color-mix(in srgb, var(--slide-accent), var(--slide-white) 48%)",
  },
  [STYLE_REF.titleTitle]: {
    display: "flex",
    alignItems: "flex-end",
    fontFamily: "var(--slide-font-display)",
    fontWeight: 800,
    fontSize: 104,
    lineHeight: 1,
    letterSpacing: "-0.02em",
    color: "var(--slide-white)",
  },
  [STYLE_REF.titleRule]: {
    background: "var(--slide-accent)",
    borderRadius: 999,
  },
  [STYLE_REF.titleSubtitle]: {
    display: "flex",
    fontFamily: "var(--slide-font-body)",
    fontSize: 32,
    lineHeight: 1.4,
    color: "var(--slide-white)",
    opacity: 0.82,
  },
  [STYLE_REF.titleFooter]: {
    display: "flex",
    alignItems: "center",
    fontFamily: "var(--slide-font-body)",
    fontSize: 20,
    letterSpacing: "0.04em",
    color: "var(--slide-white)",
    opacity: 0.55,
  },

  // — Table + sidebar archetype (dark text on the white stage + primary callout) —
  [STYLE_REF.sidebarEyebrow]: {
    display: "flex",
    alignItems: "center",
    fontFamily: "var(--slide-font-body)",
    fontWeight: 600,
    fontSize: 20,
    letterSpacing: "0.28em",
    textTransform: "uppercase",
    color: "var(--slide-accent)",
  },
  [STYLE_REF.sidebarHeading]: {
    display: "flex",
    alignItems: "flex-start",
    fontFamily: "var(--slide-font-display)",
    fontWeight: 800,
    fontSize: 56,
    lineHeight: 1.05,
    letterSpacing: "-0.015em",
    color: "var(--slide-primary)",
  },
  [STYLE_REF.sidebarRow]: {
    display: "flex",
    alignItems: "center",
    fontFamily: "var(--slide-font-body)",
    fontSize: 25,
    color: "var(--slide-text-dark)",
    borderBottom:
      "1px solid color-mix(in srgb, var(--slide-text-muted), var(--slide-white) 60%)",
  },
  [STYLE_REF.sidebarPanel]: {
    background: "var(--slide-primary)",
    borderRadius: 18,
    padding: "44px 46px",
    color: "var(--slide-white)",
  },
  [STYLE_REF.sidebarFooter]: {
    display: "flex",
    alignItems: "center",
    fontFamily: "var(--slide-font-body)",
    fontSize: 18,
    letterSpacing: "0.04em",
    color: "var(--slide-text-muted)",
  },
};

/** Resolve a styleRef to concrete CSS. Unknown refs render unstyled (never throw). */
export function resolveStyle(styleRef: string): CSSProperties {
  return STYLE_PRESETS[styleRef] ?? {};
}

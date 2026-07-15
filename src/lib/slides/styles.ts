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
  sidebarDarkRow: "sidebar/dark-row",
  sidebarPanel: "sidebar/panel",
  sidebarFooter: "sidebar/footer",

  // — Shared white-stage header (card-grid / two-column / stat) —
  contentEyebrow: "content/eyebrow",
  contentHeading: "content/heading",
  contentIntro: "content/intro",
  contentFooter: "content/footer",

  // — Card grid —
  cardBg: "card/bg",
  cardTitle: "card/title",
  cardValue: "card/value",
  cardDesc: "card/desc",

  // — Two column —
  twoColLeftList: "twocol/left-list",
  twoColRightLabel: "twocol/right-label",
  twoColRightBody: "twocol/right-body",

  // — Stat —
  statFigure: "stat/figure",
  statLabel: "stat/label",
  statCaption: "stat/caption",

  // — Section divider —
  dividerBg: "divider/bg",
  dividerEyebrow: "divider/eyebrow",
  dividerTitle: "divider/title",
  dividerRule: "divider/rule",

  // — Callout —
  calloutEyebrow: "callout/eyebrow",
  calloutRule: "callout/rule",
  calloutQuote: "callout/quote",
  calloutAttribution: "callout/attribution",

  // — Table + sidebar: structured stat panel (replaces the lone-paragraph panel) —
  sidebarPanelBg: "sidebar/panel-bg",
  sidebarPanelLabel: "sidebar/panel-label",
  sidebarPanelFigure: "sidebar/panel-figure",
  sidebarPanelCaption: "sidebar/panel-caption",
} as const;

type TKnownStyleRef = (typeof STYLE_REF)[keyof typeof STYLE_REF];

/** Style references the design extractor is allowed to assign to generated slots. */
export const STYLE_REFS = Object.values(STYLE_REF) as [
  TKnownStyleRef,
  ...Array<TKnownStyleRef>,
];

/** Presets that paint visual regions instead of text. */
export const BLOCK_STYLE_REFS = new Set<string>([
  STYLE_REF.titleBg,
  STYLE_REF.titleRule,
  STYLE_REF.cardBg,
  STYLE_REF.dividerBg,
  STYLE_REF.dividerRule,
  STYLE_REF.calloutRule,
  STYLE_REF.sidebarPanelBg,
]);

/** Block presets whose contained text needs light-on-dark styling. */
export const DARK_BLOCK_STYLE_REFS = new Set<string>([
  STYLE_REF.titleBg,
  STYLE_REF.sidebarPanelBg,
]);

/** Block presets that define a containing surface for nested text. */
export const SURFACE_BLOCK_STYLE_REFS = new Set<string>([
  STYLE_REF.titleBg,
  STYLE_REF.cardBg,
  STYLE_REF.dividerBg,
  STYLE_REF.sidebarPanelBg,
]);

/** Text presets designed to render on a primary/dark surface. */
export const DARK_TEXT_STYLE_REFS = new Set<string>([
  STYLE_REF.titleLogo,
  STYLE_REF.titleEyebrow,
  STYLE_REF.titleTitle,
  STYLE_REF.titleSubtitle,
  STYLE_REF.titleFooter,
  STYLE_REF.sidebarDarkRow,
  STYLE_REF.sidebarPanelLabel,
  STYLE_REF.sidebarPanelFigure,
  STYLE_REF.sidebarPanelCaption,
]);

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
  [STYLE_REF.sidebarDarkRow]: {
    display: "flex",
    alignItems: "center",
    fontFamily: "var(--slide-font-body)",
    fontSize: 25,
    color: "var(--slide-white)",
    borderBottom:
      "1px solid color-mix(in srgb, var(--slide-white), transparent 62%)",
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

  // — Shared white-stage header (card-grid / two-column / stat) —
  [STYLE_REF.contentEyebrow]: {
    display: "flex",
    alignItems: "center",
    fontFamily: "var(--slide-font-body)",
    fontWeight: 600,
    fontSize: 20,
    letterSpacing: "0.28em",
    textTransform: "uppercase",
    color: "var(--slide-accent)",
  },
  [STYLE_REF.contentHeading]: {
    display: "flex",
    alignItems: "flex-start",
    fontFamily: "var(--slide-font-display)",
    fontWeight: 800,
    fontSize: 52,
    lineHeight: 1.06,
    letterSpacing: "-0.015em",
    color: "var(--slide-primary)",
  },
  [STYLE_REF.contentIntro]: {
    display: "flex",
    fontFamily: "var(--slide-font-body)",
    fontSize: 26,
    lineHeight: 1.45,
    color: "var(--slide-text-muted)",
  },
  [STYLE_REF.contentFooter]: {
    display: "flex",
    alignItems: "center",
    fontFamily: "var(--slide-font-body)",
    fontSize: 18,
    letterSpacing: "0.04em",
    color: "var(--slide-text-muted)",
  },

  // — Card grid: a surface card holding title / figure / description —
  [STYLE_REF.cardBg]: {
    background: "var(--slide-surface)",
    borderRadius: 16,
    border:
      "1px solid color-mix(in srgb, var(--slide-text-muted), var(--slide-white) 62%)",
  },
  [STYLE_REF.cardTitle]: {
    display: "flex",
    alignItems: "flex-start",
    fontFamily: "var(--slide-font-display)",
    fontWeight: 700,
    fontSize: 26,
    lineHeight: 1.15,
    color: "var(--slide-primary)",
  },
  [STYLE_REF.cardValue]: {
    display: "flex",
    alignItems: "flex-end",
    fontFamily: "var(--slide-font-display)",
    fontWeight: 800,
    fontSize: 36,
    lineHeight: 1.05,
    letterSpacing: "-0.01em",
    color: "var(--slide-accent)",
  },
  [STYLE_REF.cardDesc]: {
    display: "flex",
    fontFamily: "var(--slide-font-body)",
    fontSize: 20,
    lineHeight: 1.45,
    color: "var(--slide-text-muted)",
  },

  // — Two column: accent-border list (left) + prose/secondary list (right) —
  [STYLE_REF.twoColLeftList]: {
    display: "flex",
    fontFamily: "var(--slide-font-body)",
    fontSize: 26,
    lineHeight: 1.9,
    color: "var(--slide-text-dark)",
    borderLeft: "4px solid var(--slide-accent)",
    paddingLeft: 28,
  },
  [STYLE_REF.twoColRightLabel]: {
    display: "flex",
    alignItems: "center",
    fontFamily: "var(--slide-font-body)",
    fontWeight: 700,
    fontSize: 18,
    letterSpacing: "0.18em",
    textTransform: "uppercase",
    color: "var(--slide-primary)",
  },
  [STYLE_REF.twoColRightBody]: {
    display: "flex",
    fontFamily: "var(--slide-font-body)",
    fontSize: 24,
    lineHeight: 1.55,
    color: "var(--slide-text-dark)",
  },

  // — Stat: one to three large metric figures with labels —
  [STYLE_REF.statFigure]: {
    display: "flex",
    alignItems: "flex-end",
    fontFamily: "var(--slide-font-display)",
    fontWeight: 800,
    fontSize: 104,
    lineHeight: 1,
    letterSpacing: "-0.02em",
    color: "var(--slide-accent)",
  },
  [STYLE_REF.statLabel]: {
    display: "flex",
    alignItems: "center",
    fontFamily: "var(--slide-font-body)",
    fontWeight: 700,
    fontSize: 22,
    letterSpacing: "0.16em",
    textTransform: "uppercase",
    color: "var(--slide-primary)",
  },
  [STYLE_REF.statCaption]: {
    display: "flex",
    fontFamily: "var(--slide-font-body)",
    fontSize: 20,
    lineHeight: 1.45,
    color: "var(--slide-text-muted)",
  },

  // — Section divider: minimal, light surface stage with a big navy title —
  [STYLE_REF.dividerBg]: {
    background: "var(--slide-surface)",
  },
  [STYLE_REF.dividerEyebrow]: {
    display: "flex",
    alignItems: "flex-end",
    fontFamily: "var(--slide-font-body)",
    fontWeight: 700,
    fontSize: 24,
    letterSpacing: "0.3em",
    textTransform: "uppercase",
    color: "var(--slide-accent)",
  },
  [STYLE_REF.dividerTitle]: {
    display: "flex",
    alignItems: "flex-start",
    fontFamily: "var(--slide-font-display)",
    fontWeight: 800,
    fontSize: 92,
    lineHeight: 1.02,
    letterSpacing: "-0.02em",
    color: "var(--slide-primary)",
  },
  [STYLE_REF.dividerRule]: {
    background: "var(--slide-accent)",
    borderRadius: 999,
  },

  // — Callout: a prominent statement/quote + attribution —
  [STYLE_REF.calloutEyebrow]: {
    display: "flex",
    alignItems: "center",
    fontFamily: "var(--slide-font-body)",
    fontWeight: 600,
    fontSize: 20,
    letterSpacing: "0.28em",
    textTransform: "uppercase",
    color: "var(--slide-accent)",
  },
  [STYLE_REF.calloutRule]: {
    background: "var(--slide-accent)",
    borderRadius: 999,
  },
  [STYLE_REF.calloutQuote]: {
    display: "flex",
    alignItems: "flex-start",
    fontFamily: "var(--slide-font-display)",
    fontWeight: 700,
    fontSize: 52,
    lineHeight: 1.25,
    letterSpacing: "-0.01em",
    color: "var(--slide-primary)",
  },
  [STYLE_REF.calloutAttribution]: {
    display: "flex",
    alignItems: "center",
    fontFamily: "var(--slide-font-body)",
    fontWeight: 600,
    fontSize: 24,
    color: "var(--slide-text-muted)",
  },

  // — Table + sidebar: structured stat panel on the primary stage —
  [STYLE_REF.sidebarPanelBg]: {
    background: "var(--slide-primary)",
    borderRadius: 18,
  },
  [STYLE_REF.sidebarPanelLabel]: {
    display: "flex",
    alignItems: "center",
    fontFamily: "var(--slide-font-body)",
    fontWeight: 600,
    fontSize: 20,
    letterSpacing: "0.24em",
    textTransform: "uppercase",
    color: "color-mix(in srgb, var(--slide-accent), var(--slide-white) 55%)",
  },
  [STYLE_REF.sidebarPanelFigure]: {
    display: "flex",
    alignItems: "flex-start",
    fontFamily: "var(--slide-font-display)",
    fontWeight: 800,
    fontSize: 84,
    lineHeight: 1.02,
    letterSpacing: "-0.02em",
    color: "var(--slide-white)",
  },
  [STYLE_REF.sidebarPanelCaption]: {
    display: "flex",
    fontFamily: "var(--slide-font-body)",
    fontSize: 22,
    lineHeight: 1.5,
    color: "var(--slide-white)",
    opacity: 0.8,
  },
};

/** Resolve a styleRef to concrete CSS. Unknown refs render unstyled (never throw). */
export function resolveStyle(styleRef: string): CSSProperties {
  return STYLE_PRESETS[styleRef] ?? {};
}

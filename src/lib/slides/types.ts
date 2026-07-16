/**
 * Canonical slide domain model.
 *
 * Every slide lives in ONE fixed coordinate space — {@link CANVAS} (1440×810, 16:9).
 * Elements are positioned in those canonical units and never in raw screen pixels.
 * The preview renders the full canonical stage and scales it uniformly to fit its
 * container (see `useCanvasScale`); the single scale factor is the seam that the
 * upcoming rectangle-selection feature inverts to map pointer px → canonical units.
 *
 * This module is intentionally runtime-free (pure types + one const) so it can grow
 * into the shared domain module consumed by generation/edit server functions later.
 */

/** The canonical slide space. Every x/y/w/h below is expressed in these units. */
export const CANVAS = { width: 1440, height: 810 } as const;

/** Roles extraction may assign to a slot. Unknown semantics normalize to `custom`. */
export const SLOT_ROLES = [
  "logo",
  "eyebrow",
  "title",
  "subtitle",
  "heading",
  "body",
  "block",
  "tableRow",
  "panel",
  "footer",
  "custom",
] as const;
export type TSlotRole = (typeof SLOT_ROLES)[number];

/**
 * A layout skeleton's name/label — free-form, not an enum. Extraction reads
 * arbitrary design PDFs and may produce archetype names we can't enumerate ahead
 * of time, so this stays an open string.
 */
export type TArchetypeId = string;

/** Coarse content shape used to describe extracted layouts to the planner. */
export const ARCHETYPE_CATEGORIES = [
  "cover",
  "section",
  "statement",
  "parallel-items",
  "metrics",
  "table",
  "mixed",
] as const;
export type TArchetypeCategory = (typeof ARCHETYPE_CATEGORIES)[number];

/** How an element arranges its own children, when it has any. */
export type TSlotLayout = "stack" | "grid" | "centered";

/**
 * A key describing how to style a slot/element. Resolved to concrete CSS by
 * `resolveStyle` (see `styles.ts`) — kept as an opaque string in the model so the
 * data layer never hardcodes visual CSS.
 */
export type TStyleRef = string;

/** Design tokens approximating a corporate design system. */
export interface ITokens {
  colors: {
    primary: string;
    surface: string;
    accent: string;
    white: string;
    textDark: string;
    textMuted: string;
  };
  fonts: {
    display: string;
    body: string;
  };
}

/** A named, positioned region inside an archetype. Geometry is in canonical units. */
export interface ISlot {
  id: string;
  role: TSlotRole;
  x: number;
  y: number;
  w: number;
  h: number;
  styleRef: TStyleRef;
  layout?: TSlotLayout;
}

/** A reusable layout skeleton: a named set of slots. */
export interface IArchetype {
  id: TArchetypeId;
  name: string;
  slots: Array<ISlot>;
}

/** Planner-facing metadata shared by built-in families and extracted archetypes. */
export interface IArchetypeDescriptor {
  id: TArchetypeId;
  name: string;
  category: TArchetypeCategory;
  description: string;
}

/** A validated layout skeleton extracted from a design PDF. */
export interface IExtractedArchetype extends IArchetype {
  category: TArchetypeCategory;
  description: string;
}

/** A label/value pair — content for a `tableRow` element. */
export interface ILabelValue {
  label: string;
  value: string;
}

/** A heading + body pair — content for a `panel` element. */
export interface IPanelContent {
  heading: string;
  body: string;
}

/** The content poured into a filled slot. Kept simple/typed per role; the renderer
 * narrows the structured shapes ({@link ILabelValue}, {@link IPanelContent}). */
export type TSlotContent =
  | string
  | Array<string>
  | ILabelValue
  | IPanelContent
  | Record<string, unknown>;

/** A filled slot on an actual slide: content + resolved canonical geometry. */
export interface ISlideElement {
  id: string;
  slotId: string;
  role: TSlotRole;
  x: number;
  y: number;
  w: number;
  h: number;
  content: TSlotContent;
  styleRef: TStyleRef;
}

/** An ordered list of elements rendered in one canonical stage. */
export interface ISlide {
  id: string;
  archetypeId: TArchetypeId;
  elements: Array<ISlideElement>;
}

/** A deck is an ordered list of slides. */
export interface IDeck {
  id: string;
  slides: Array<ISlide>;
}

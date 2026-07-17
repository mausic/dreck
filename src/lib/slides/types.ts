export const CANVAS = { width: 1440, height: 810 } as const;

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

export type TArchetypeId = string;

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

export type TSlotLayout = "stack" | "grid" | "centered";

export type TStyleRef = string;

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

export interface IArchetype {
  id: TArchetypeId;
  name: string;
  slots: Array<ISlot>;
}

export interface IArchetypeDescriptor {
  id: TArchetypeId;
  name: string;
  category: TArchetypeCategory;
  description: string;
}

export interface IExtractedArchetype extends IArchetype {
  category: TArchetypeCategory;
  description: string;
}

export interface ILabelValue {
  label: string;
  value: string;
}

export interface IPanelContent {
  heading: string;
  body: string;
}

export type TSlotContent =
  | string
  | Array<string>
  | ILabelValue
  | IPanelContent
  | Record<string, unknown>;

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

export interface ISlide {
  id: string;
  archetypeId: TArchetypeId;
  elements: Array<ISlideElement>;
}

export interface IDeck {
  id: string;
  slides: Array<ISlide>;
}

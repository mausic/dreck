import type { IArchetype, ISlot } from "@/lib/slides/types";
import { STYLE_REF } from "@/lib/slides/styles";

/**
 * Reusable layout skeletons. Two are fully defined here (`title`, `table-sidebar`)
 * with real slot geometry in canonical 1440×810 units — enough to prove the renderer
 * generalizes across visibly distinct archetypes. `card-grid` / `two-column` (spec §6)
 * are intentionally deferred to a later task.
 *
 * All geometry below is CANONICAL. Nothing here knows about rendered pixels.
 */

/** Title slide: full-bleed navy, eyebrow + big title + short rule + subtitle + footer. */
const titleArchetype: IArchetype = {
  id: "title",
  name: "Title",
  slots: [
    {
      id: "bg",
      role: "block",
      x: 0,
      y: 0,
      w: 1440,
      h: 810,
      styleRef: STYLE_REF.titleBg,
    },
    {
      id: "logo",
      role: "logo",
      x: 120,
      y: 96,
      w: 400,
      h: 44,
      styleRef: STYLE_REF.titleLogo,
    },
    {
      id: "eyebrow",
      role: "eyebrow",
      x: 120,
      y: 300,
      w: 900,
      h: 40,
      styleRef: STYLE_REF.titleEyebrow,
    },
    {
      id: "title",
      role: "title",
      x: 120,
      y: 346,
      w: 1160,
      h: 240,
      styleRef: STYLE_REF.titleTitle,
    },
    {
      id: "rule",
      role: "block",
      x: 124,
      y: 612,
      w: 168,
      h: 8,
      styleRef: STYLE_REF.titleRule,
    },
    {
      id: "subtitle",
      role: "subtitle",
      x: 124,
      y: 648,
      w: 880,
      h: 96,
      styleRef: STYLE_REF.titleSubtitle,
    },
    {
      id: "footer",
      role: "footer",
      x: 120,
      y: 750,
      w: 1200,
      h: 36,
      styleRef: STYLE_REF.titleFooter,
    },
  ],
};

// Left column of label/value rows — geometry kept regular so rows stack cleanly.
const ROW_COUNT = 5;
const ROW_TOP = 316;
const ROW_STEP = 74;
const ROW_HEIGHT = 64;

const sidebarRowSlots: Array<ISlot> = Array.from(
  { length: ROW_COUNT },
  (_, i) => ({
    id: `row-${i + 1}`,
    role: "tableRow",
    x: 80,
    y: ROW_TOP + i * ROW_STEP,
    w: 740,
    h: ROW_HEIGHT,
    styleRef: STYLE_REF.sidebarRow,
  }),
);

/** Table + sidebar: eyebrow + heading + a left column of label/value rows + navy panel. */
const tableSidebarArchetype: IArchetype = {
  id: "table-sidebar",
  name: "Table + sidebar",
  slots: [
    {
      id: "eyebrow",
      role: "eyebrow",
      x: 80,
      y: 88,
      w: 700,
      h: 34,
      styleRef: STYLE_REF.sidebarEyebrow,
    },
    {
      id: "heading",
      role: "heading",
      x: 80,
      y: 132,
      w: 740,
      h: 150,
      styleRef: STYLE_REF.sidebarHeading,
    },
    ...sidebarRowSlots,
    {
      id: "footer",
      role: "footer",
      x: 80,
      y: 726,
      w: 740,
      h: 30,
      styleRef: STYLE_REF.sidebarFooter,
    },
    {
      id: "panel",
      role: "panel",
      x: 872,
      y: 88,
      w: 488,
      h: 634,
      styleRef: STYLE_REF.sidebarPanel,
      layout: "centered",
    },
  ],
};

/** All defined archetypes, keyed by id for lookup during generation/rendering. */
export const ARCHETYPES = {
  [titleArchetype.id]: titleArchetype,
  [tableSidebarArchetype.id]: tableSidebarArchetype,
} satisfies Partial<Record<IArchetype["id"], IArchetype>>;

/** Look up an archetype by id. Ids are free-form strings; callers pass known ones. */
export function getArchetype(id: string): IArchetype {
  return ARCHETYPES[id];
}

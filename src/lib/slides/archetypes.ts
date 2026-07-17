import type {
  IArchetype,
  IArchetypeDescriptor,
  ISlot,
} from "@/lib/slides/types";
import { STYLE_REF } from "@/lib/slides/styles";

const MARGIN = 96;
const CONTENT_W = 1440 - MARGIN * 2; // 1248

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

function whiteHeader(opts: { intro: boolean }): Array<ISlot> {
  const slots: Array<ISlot> = [
    {
      id: "eyebrow",
      role: "eyebrow",
      x: MARGIN,
      y: 84,
      w: 1000,
      h: 30,
      styleRef: STYLE_REF.contentEyebrow,
    },
    {
      id: "heading",
      role: "heading",
      x: MARGIN,
      y: 122,
      w: 1150,
      h: 110,
      styleRef: STYLE_REF.contentHeading,
    },
  ];
  if (opts.intro) {
    slots.push({
      id: "intro",
      role: "subtitle",
      x: MARGIN,
      y: 240,
      w: 980,
      h: 64,
      styleRef: STYLE_REF.contentIntro,
    });
  }
  slots.push({
    id: "footer",
    role: "footer",
    x: MARGIN,
    y: 744,
    w: CONTENT_W,
    h: 28,
    styleRef: STYLE_REF.contentFooter,
  });
  return slots;
}

const CARD_TOP = 336;
const CARD_H = 352;
const CARD_GAP = 28;
const CARD_PAD = 32;

function cardSlots(count: number): Array<ISlot> {
  const cardW = Math.floor((CONTENT_W - (count - 1) * CARD_GAP) / count);
  const innerW = cardW - CARD_PAD * 2;
  const slots: Array<ISlot> = [];
  for (let i = 0; i < count; i++) {
    const cardX = MARGIN + i * (cardW + CARD_GAP);
    const innerX = cardX + CARD_PAD;
    const n = i + 1;
    slots.push(
      {
        id: `card${n}-bg`,
        role: "block",
        x: cardX,
        y: CARD_TOP,
        w: cardW,
        h: CARD_H,
        styleRef: STYLE_REF.cardBg,
      },
      {
        id: `card${n}-title`,
        role: "custom",
        x: innerX,
        y: CARD_TOP + 36,
        w: innerW,
        h: 64,
        styleRef: STYLE_REF.cardTitle,
      },
      {
        id: `card${n}-value`,
        role: "custom",
        x: innerX,
        y: CARD_TOP + 112,
        w: innerW,
        h: 60,
        styleRef: STYLE_REF.cardValue,
      },
      {
        id: `card${n}-desc`,
        role: "custom",
        x: innerX,
        y: CARD_TOP + 188,
        w: innerW,
        h: 140,
        styleRef: STYLE_REF.cardDesc,
      },
    );
  }
  return slots;
}

function makeCardGrid(count: number): IArchetype {
  return {
    id: `card-grid-${count}`,
    name: `Card grid (${count})`,
    slots: [...whiteHeader({ intro: true }), ...cardSlots(count)],
  };
}

const twoColumnArchetype: IArchetype = {
  id: "two-column",
  name: "Two column",
  slots: [
    {
      id: "eyebrow",
      role: "eyebrow",
      x: MARGIN,
      y: 84,
      w: 1000,
      h: 30,
      styleRef: STYLE_REF.contentEyebrow,
    },
    {
      id: "heading",
      role: "heading",
      x: MARGIN,
      y: 122,
      w: 1150,
      h: 120,
      styleRef: STYLE_REF.contentHeading,
    },
    {
      id: "left-list",
      role: "body",
      x: MARGIN,
      y: 300,
      w: 560,
      h: 410,
      styleRef: STYLE_REF.twoColLeftList,
    },
    {
      id: "right-label",
      role: "eyebrow",
      x: 744,
      y: 300,
      w: 600,
      h: 28,
      styleRef: STYLE_REF.twoColRightLabel,
    },
    {
      id: "right-body",
      role: "custom",
      x: 744,
      y: 344,
      w: 600,
      h: 366,
      styleRef: STYLE_REF.twoColRightBody,
    },
    {
      id: "footer",
      role: "footer",
      x: MARGIN,
      y: 744,
      w: CONTENT_W,
      h: 28,
      styleRef: STYLE_REF.contentFooter,
    },
  ],
};

const STAT_TOP = 360;
const STAT_GAP = 48;

function statSlots(count: number): Array<ISlot> {
  const blockW = Math.floor((CONTENT_W - (count - 1) * STAT_GAP) / count);
  const slots: Array<ISlot> = [];
  for (let i = 0; i < count; i++) {
    const x = MARGIN + i * (blockW + STAT_GAP);
    const n = i + 1;
    slots.push(
      {
        id: `stat${n}-figure`,
        role: "custom",
        x,
        y: STAT_TOP,
        w: blockW,
        h: 140,
        styleRef: STYLE_REF.statFigure,
      },
      {
        id: `stat${n}-label`,
        role: "custom",
        x,
        y: STAT_TOP + 152,
        w: blockW,
        h: 32,
        styleRef: STYLE_REF.statLabel,
      },
      {
        id: `stat${n}-caption`,
        role: "custom",
        x,
        y: STAT_TOP + 196,
        w: blockW,
        h: 104,
        styleRef: STYLE_REF.statCaption,
      },
    );
  }
  return slots;
}

function makeStat(count: number): IArchetype {
  return {
    id: `stat-${count}`,
    name: `Stat (${count})`,
    slots: [...whiteHeader({ intro: true }), ...statSlots(count)],
  };
}

const sectionDividerArchetype: IArchetype = {
  id: "section-divider",
  name: "Section divider",
  slots: [
    {
      id: "bg",
      role: "block",
      x: 0,
      y: 0,
      w: 1440,
      h: 810,
      styleRef: STYLE_REF.dividerBg,
    },
    {
      id: "eyebrow",
      role: "eyebrow",
      x: 120,
      y: 320,
      w: 900,
      h: 36,
      styleRef: STYLE_REF.dividerEyebrow,
    },
    {
      id: "title",
      role: "title",
      x: 120,
      y: 368,
      w: 1200,
      h: 220,
      styleRef: STYLE_REF.dividerTitle,
    },
    {
      id: "rule",
      role: "block",
      x: 124,
      y: 604,
      w: 180,
      h: 8,
      styleRef: STYLE_REF.dividerRule,
    },
  ],
};

const calloutArchetype: IArchetype = {
  id: "callout",
  name: "Callout",
  slots: [
    {
      id: "eyebrow",
      role: "eyebrow",
      x: 160,
      y: 250,
      w: 900,
      h: 30,
      styleRef: STYLE_REF.calloutEyebrow,
    },
    {
      id: "rule",
      role: "block",
      x: 160,
      y: 300,
      w: 120,
      h: 10,
      styleRef: STYLE_REF.calloutRule,
    },
    {
      id: "quote",
      role: "custom",
      x: 160,
      y: 336,
      w: 1120,
      h: 300,
      styleRef: STYLE_REF.calloutQuote,
    },
    {
      id: "attribution",
      role: "custom",
      x: 160,
      y: 660,
      w: 900,
      h: 40,
      styleRef: STYLE_REF.calloutAttribution,
    },
  ],
};

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
      id: "panel-bg",
      role: "block",
      x: 872,
      y: 88,
      w: 488,
      h: 634,
      styleRef: STYLE_REF.sidebarPanelBg,
    },
    {
      id: "panel-label",
      role: "eyebrow",
      x: 918,
      y: 150,
      w: 396,
      h: 30,
      styleRef: STYLE_REF.sidebarPanelLabel,
    },
    {
      id: "panel-figure",
      role: "custom",
      x: 918,
      y: 206,
      w: 396,
      h: 150,
      styleRef: STYLE_REF.sidebarPanelFigure,
    },
    {
      id: "panel-caption",
      role: "custom",
      x: 918,
      y: 384,
      w: 396,
      h: 290,
      styleRef: STYLE_REF.sidebarPanelCaption,
    },
  ],
};

const ALL_ARCHETYPES: Array<IArchetype> = [
  titleArchetype,
  sectionDividerArchetype,
  calloutArchetype,
  twoColumnArchetype,
  tableSidebarArchetype,
  ...[2, 3, 4].map(makeCardGrid),
  ...[1, 2, 3].map(makeStat),
];

export const ARCHETYPES: Record<string, IArchetype> = Object.fromEntries(
  ALL_ARCHETYPES.map((archetype) => [archetype.id, archetype]),
);

export const ARCHETYPE_FAMILIES = [
  "title",
  "section-divider",
  "callout",
  "two-column",
  "table-sidebar",
  "card-grid",
  "stat",
] as const;
export type TArchetypeFamily = (typeof ARCHETYPE_FAMILIES)[number];

export const ARCHETYPE_FAMILY_DESCRIPTORS: Array<IArchetypeDescriptor> = [
  {
    id: "title",
    name: "Title",
    category: "cover",
    description:
      "Opening cover with eyebrow, large title, subtitle, and footer.",
  },
  {
    id: "section-divider",
    name: "Section divider",
    category: "section",
    description:
      "Minimal transition or chapter break with almost no body content.",
  },
  {
    id: "callout",
    name: "Callout",
    category: "statement",
    description: "One prominent warning, takeaway, quote, or key message.",
  },
  {
    id: "two-column",
    name: "Two column",
    category: "mixed",
    description: "A list of points beside explanatory prose.",
  },
  {
    id: "table-sidebar",
    name: "Table + sidebar",
    category: "table",
    description: "Several label-value rows beside a highlighted metric panel.",
  },
  {
    id: "card-grid",
    name: "Card grid",
    category: "parallel-items",
    description: "Two to four comparable items presented as parallel cards.",
  },
  {
    id: "stat",
    name: "Statistics",
    category: "metrics",
    description:
      "One to three headline numbers with short labels and captions.",
  },
];

export function getArchetype(id: string): IArchetype | undefined {
  return ARCHETYPES[id];
}

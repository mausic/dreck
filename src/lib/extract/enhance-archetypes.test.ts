import { describe, expect, it } from "vitest";
import type { IExtractedArchetype } from "@/lib/slides/types";
import type { IRawExtractedArchetype } from "@/lib/extract/enhance-archetypes";
import { STYLE_REF } from "@/lib/slides/styles";
import { textCapacity, verifySlideFit } from "@/lib/ai/fit";
import { enhanceExtractedArchetypes } from "@/lib/extract/enhance-archetypes";
import { previewContentForRole } from "@/lib/slides/preview-content";

function cover(): IExtractedArchetype {
  return {
    id: "cover",
    name: "Cover",
    category: "cover",
    description: "Dark cover",
    slots: [
      {
        id: "background",
        role: "block",
        x: 0,
        y: 0,
        w: 1440,
        h: 810,
        styleRef: STYLE_REF.titleBg,
      },
      {
        id: "title",
        role: "title",
        x: 120,
        y: 300,
        w: 1160,
        h: 220,
        styleRef: STYLE_REF.titleTitle,
      },
    ],
  };
}

function statement(): IExtractedArchetype {
  return {
    id: "statement",
    name: "Statement",
    category: "statement",
    description: "Large statement",
    slots: [
      {
        id: "eyebrow",
        role: "eyebrow",
        x: 160,
        y: 220,
        w: 900,
        h: 32,
        styleRef: STYLE_REF.calloutEyebrow,
      },
      {
        id: "quote",
        role: "custom",
        x: 160,
        y: 300,
        w: 1120,
        h: 240,
        styleRef: STYLE_REF.calloutQuote,
      },
    ],
  };
}

function catalog(content: IExtractedArchetype): Array<IExtractedArchetype> {
  return [cover(), content, statement()];
}

describe("enhanceExtractedArchetypes", () => {
  it("can prepare one detail without applying catalog-level cover rules", () => {
    const detail = statement();
    detail.category = "mixed";
    detail.name = "Title and content";
    const result = enhanceExtractedArchetypes([detail], {
      validateCatalog: false,
    });
    expect(result.archetypes).toHaveLength(1);
    expect(result.archetypes[0].category).toBe("mixed");
  });

  it("normalizes permissive model output before strict validation", () => {
    const raw: Array<IRawExtractedArchetype> = catalog(statement());
    raw[0].id = "1. Opening Cover";
    raw[0].category = "TITLE_SLIDE";
    raw[1].id = "1. Opening Cover";
    raw[1].category = "quote layout";
    raw[1].slots[0].id = "Repeated Slot";
    raw[1].slots[1].id = "Repeated Slot";
    raw[1].slots[0].role = "TEXT";
    raw[1].slots[0].styleRef = "invented/text-style";
    raw[1].slots[0].x = -25.4;
    raw[1].slots[0].w = 2000;

    const result = enhanceExtractedArchetypes(raw);
    expect(result.archetypes[0].id).toBe("layout-1-opening-cover");
    expect(result.archetypes[1].id).toBe("layout-1-opening-cover-2");
    expect(result.archetypes[1].category).toBe("statement");
    expect(result.archetypes[1].slots[0].role).toBe("custom");
    expect(result.archetypes[1].slots[0].x).toBe(0);
    expect(result.archetypes[1].slots[0].w).toBe(1440);
    expect(result.archetypes[1].slots[1].id).toBe("repeated-slot-2");
    expect(result.archetypes[1].slots[0].styleRef).not.toBe(
      "invented/text-style",
    );
  });

  it("orders large backgrounds before smaller blocks and text", () => {
    const detail = statement();
    detail.slots = [
      detail.slots[1],
      {
        id: "rule",
        role: "block",
        x: 100,
        y: 250,
        w: 140,
        h: 8,
        styleRef: STYLE_REF.calloutRule,
      },
      {
        id: "background",
        role: "block",
        x: 0,
        y: 0,
        w: 1440,
        h: 810,
        styleRef: STYLE_REF.cardBg,
      },
    ];

    const result = enhanceExtractedArchetypes([detail], {
      validateCatalog: false,
    });
    expect(result.archetypes[0].slots.map((slot) => slot.id)).toEqual([
      "background",
      "rule",
      "quote",
    ]);
  });

  it("downgrades typography when a large heading cannot fit its box", () => {
    const content: IExtractedArchetype = {
      id: "short-heading",
      name: "Short heading",
      category: "mixed",
      description: "Heading in a shallow region",
      slots: [
        {
          id: "heading",
          role: "heading",
          x: 96,
          y: 100,
          w: 600,
          h: 32,
          styleRef: STYLE_REF.contentHeading,
        },
        {
          id: "body",
          role: "body",
          x: 96,
          y: 200,
          w: 600,
          h: 220,
          styleRef: STYLE_REF.twoColRightBody,
        },
      ],
    };

    const result = enhanceExtractedArchetypes(catalog(content));
    const heading = result.archetypes[1].slots[0];
    expect(heading.styleRef).not.toBe(STYLE_REF.contentHeading);
    expect(
      textCapacity(heading.role, heading.styleRef, heading.w, heading.h)
        .maxLines,
    ).toBeGreaterThanOrEqual(1);
  });

  it("uses a light-on-dark row style inside a primary panel", () => {
    const content: IExtractedArchetype = {
      id: "dark-table",
      name: "Dark table",
      category: "table",
      description: "Rows inside a dark panel",
      slots: [
        {
          id: "panel-background",
          role: "block",
          x: 720,
          y: 120,
          w: 600,
          h: 540,
          styleRef: STYLE_REF.sidebarPanelBg,
        },
        {
          id: "row-one",
          role: "tableRow",
          x: 770,
          y: 220,
          w: 500,
          h: 70,
          styleRef: STYLE_REF.sidebarRow,
        },
      ],
    };

    const result = enhanceExtractedArchetypes(catalog(content));
    expect(result.archetypes[1].slots[1].styleRef).toBe(
      STYLE_REF.sidebarDarkRow,
    );
  });

  it("separates substantially overlapping text regions", () => {
    const content: IExtractedArchetype = {
      id: "overlap",
      name: "Overlap",
      category: "mixed",
      description: "Two overlapping text regions",
      slots: [
        {
          id: "first",
          role: "custom",
          x: 100,
          y: 100,
          w: 500,
          h: 80,
          styleRef: STYLE_REF.cardDesc,
        },
        {
          id: "second",
          role: "custom",
          x: 100,
          y: 150,
          w: 500,
          h: 80,
          styleRef: STYLE_REF.cardDesc,
        },
      ],
    };

    const result = enhanceExtractedArchetypes(catalog(content));
    const [first, second] = result.archetypes[1].slots;
    expect(second.y).toBeGreaterThanOrEqual(first.y + first.h + 8);
    expect(enhanceExtractedArchetypes(result.archetypes).archetypes).toEqual(
      result.archetypes,
    );
  });

  it("separates slightly overlapping text regions in the same column", () => {
    const content: IExtractedArchetype = {
      id: "crowded-warnings",
      name: "Crowded warnings",
      category: "statement",
      description: "Stacked warning text inside a panel",
      slots: [
        {
          id: "warning-one",
          role: "body",
          x: 760,
          y: 528,
          w: 568,
          h: 50,
          styleRef: STYLE_REF.titleFooter,
        },
        {
          id: "warning-two",
          role: "body",
          x: 760,
          y: 575,
          w: 568,
          h: 50,
          styleRef: STYLE_REF.titleFooter,
        },
        {
          id: "warning-three",
          role: "body",
          x: 760,
          y: 622,
          w: 568,
          h: 50,
          styleRef: STYLE_REF.titleFooter,
        },
      ],
    };

    const result = enhanceExtractedArchetypes([content], {
      validateCatalog: false,
    });
    const [first, second, third] = result.archetypes[0].slots;
    expect(second.y).toBeGreaterThanOrEqual(first.y + first.h + 8);
    expect(third.y).toBeGreaterThanOrEqual(second.y + second.h + 8);
  });

  it("centers a lone text slot within a compact surface block", () => {
    const content: IExtractedArchetype = {
      id: "compact-callout",
      name: "Compact callout",
      category: "mixed",
      description: "One text region inside a short card",
      slots: [
        {
          id: "row-background",
          role: "block",
          x: 814,
          y: 420,
          w: 518,
          h: 54,
          styleRef: STYLE_REF.cardBg,
        },
        {
          id: "row-text",
          role: "body",
          x: 834,
          y: 429,
          w: 480,
          h: 45,
          styleRef: STYLE_REF.contentFooter,
        },
      ],
    };

    const result = enhanceExtractedArchetypes([content], {
      validateCatalog: false,
    });
    const text = result.archetypes[0].slots[1];
    expect(text.y).toBe(424);
    expect(text.h).toBe(46);
    expect(
      enhanceExtractedArchetypes(result.archetypes, {
        validateCatalog: false,
      }).archetypes,
    ).toEqual(result.archetypes);
  });

  it("expands a repairable panel to its minimum usable size", () => {
    const content: IExtractedArchetype = {
      id: "small-panel",
      name: "Small panel",
      category: "statement",
      description: "A panel that is slightly too small",
      slots: [
        {
          id: "heading",
          role: "heading",
          x: 100,
          y: 100,
          w: 600,
          h: 80,
          styleRef: STYLE_REF.contentHeading,
        },
        {
          id: "panel",
          role: "panel",
          x: 1230,
          y: 680,
          w: 200,
          h: 130,
          styleRef: STYLE_REF.sidebarPanel,
        },
      ],
    };

    const result = enhanceExtractedArchetypes(catalog(content));
    const panel = result.archetypes[1].slots[1];
    expect(panel.x + panel.w).toBe(1440);
    expect(panel.y).toBe(592);
    expect(panel.w).toBeGreaterThanOrEqual(220);
    expect(panel.h).toBe(218);
  });

  it("compacts adjacent rows when there is no room to shift downward", () => {
    const content: IExtractedArchetype = {
      id: "tight-rows",
      name: "Tight rows",
      category: "table",
      description: "Rows extracted too close together near the canvas edge",
      slots: [
        {
          id: "left-value-3",
          role: "custom",
          x: 100,
          y: 710,
          w: 500,
          h: 60,
          styleRef: STYLE_REF.cardDesc,
        },
        {
          id: "left-value-4",
          role: "custom",
          x: 100,
          y: 740,
          w: 500,
          h: 60,
          styleRef: STYLE_REF.cardDesc,
        },
      ],
    };

    const result = enhanceExtractedArchetypes(catalog(content));
    const [third, fourth] = result.archetypes[1].slots;
    expect(fourth.y).toBeGreaterThanOrEqual(third.y + third.h + 8);
    expect(fourth.y + fourth.h).toBeLessThanOrEqual(810);
  });

  it("merges split label and value slots into aligned table rows", () => {
    const content: IExtractedArchetype = {
      id: "split-rows",
      name: "Split rows",
      category: "table",
      description: "Label and value columns emitted as separate slots",
      slots: [
        {
          id: "row-1-label",
          role: "heading",
          x: 78,
          y: 338,
          w: 250,
          h: 24,
          styleRef: STYLE_REF.twoColRightLabel,
        },
        {
          id: "row-1-val",
          role: "body",
          x: 508,
          y: 338,
          w: 203,
          h: 44,
          styleRef: STYLE_REF.contentFooter,
        },
        {
          id: "row-2-label",
          role: "heading",
          x: 78,
          y: 402,
          w: 250,
          h: 24,
          styleRef: STYLE_REF.twoColRightLabel,
        },
        {
          id: "row-2-value",
          role: "body",
          x: 531,
          y: 402,
          w: 212,
          h: 44,
          styleRef: STYLE_REF.contentFooter,
        },
      ],
    };

    const result = enhanceExtractedArchetypes([content], {
      validateCatalog: false,
    });
    expect(result.archetypes[0].slots).toMatchObject([
      { id: "row-1", role: "tableRow", x: 78, w: 633 },
      { id: "row-2", role: "tableRow", x: 78, w: 665 },
    ]);
  });

  it("expands slots until the exact preview copy fits", () => {
    const content: IExtractedArchetype = {
      id: "narrow-panel-heading",
      name: "Narrow panel heading",
      category: "mixed",
      description: "A tracked uppercase heading that initially wraps",
      slots: [
        {
          id: "panel-bg",
          role: "block",
          x: 739,
          y: 263,
          w: 623,
          h: 501,
          styleRef: STYLE_REF.sidebarPanelBg,
        },
        {
          id: "panel-heading",
          role: "heading",
          x: 765,
          y: 299,
          w: 206,
          h: 25,
          styleRef: STYLE_REF.sidebarPanelLabel,
        },
      ],
    };

    const result = enhanceExtractedArchetypes([content], {
      validateCatalog: false,
    });
    const heading = result.archetypes[0].slots[1];
    expect(heading.w).toBeGreaterThan(206);
    expect(
      verifySlideFit({
        id: "preview",
        archetypeId: content.id,
        elements: [
          {
            ...heading,
            slotId: heading.id,
            content: previewContentForRole(heading.role),
          },
        ],
      }).ok,
    ).toBe(true);
  });

  it("rejects a composite panel duplicated by adjacent text slots", () => {
    const content: IExtractedArchetype = {
      id: "decomposed-panel",
      name: "Decomposed panel",
      category: "mixed",
      description: "A composite panel plus separate neighboring copy",
      slots: [
        {
          id: "panel",
          role: "panel",
          x: 786,
          y: 414,
          w: 574,
          h: 218,
          styleRef: STYLE_REF.sidebarPanel,
        },
        {
          id: "panel-intro",
          role: "body",
          x: 812,
          y: 354,
          w: 522,
          h: 52,
          styleRef: STYLE_REF.contentFooter,
        },
      ],
    };

    expect(() =>
      enhanceExtractedArchetypes([content], { validateCatalog: false }),
    ).toThrow("decomposes panel");
  });
});

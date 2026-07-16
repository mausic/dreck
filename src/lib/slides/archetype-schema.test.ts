import { describe, expect, it } from "vitest";
import type { IExtractedArchetype } from "@/lib/slides/types";
import { ExtractedArchetypesSchema } from "@/lib/slides/archetype-schema";
import { STYLE_REF } from "@/lib/slides/styles";

function validArchetypes(): Array<IExtractedArchetype> {
  return [
    {
      id: "reference-cover",
      name: "Reference cover",
      category: "cover",
      description: "Full-bleed cover with a large title.",
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
          w: 1100,
          h: 220,
          styleRef: STYLE_REF.titleTitle,
        },
      ],
    },
    {
      id: "reference-content",
      name: "Reference content",
      category: "mixed",
      description: "Heading above two balanced content columns.",
      slots: [
        {
          id: "heading",
          role: "heading",
          x: 96,
          y: 96,
          w: 1248,
          h: 120,
          styleRef: STYLE_REF.contentHeading,
        },
        {
          id: "body",
          role: "body",
          x: 96,
          y: 280,
          w: 1248,
          h: 400,
          styleRef: STYLE_REF.twoColLeftList,
        },
      ],
    },
    {
      id: "reference-statement",
      name: "Reference statement",
      category: "statement",
      description: "Large statement with a short attribution.",
      slots: [
        {
          id: "statement",
          role: "custom",
          x: 160,
          y: 250,
          w: 1120,
          h: 260,
          styleRef: STYLE_REF.calloutQuote,
        },
        {
          id: "attribution",
          role: "custom",
          x: 160,
          y: 550,
          w: 900,
          h: 50,
          styleRef: STYLE_REF.calloutAttribution,
        },
      ],
    },
  ];
}

describe("ExtractedArchetypesSchema", () => {
  it("accepts a bounded catalog using known roles and style references", () => {
    expect(ExtractedArchetypesSchema.parse(validArchetypes())).toHaveLength(3);
  });

  it("accepts a partial catalog with one cover and one content layout", () => {
    expect(
      ExtractedArchetypesSchema.parse(validArchetypes().slice(0, 2)),
    ).toHaveLength(2);
  });

  it("rejects unknown style references", () => {
    const archetypes = validArchetypes();
    archetypes[1].slots[0].styleRef = "model/invented-style";
    expect(ExtractedArchetypesSchema.safeParse(archetypes).success).toBe(false);
  });

  it("rejects duplicate slot ids and out-of-bounds geometry", () => {
    const archetypes = validArchetypes();
    archetypes[1].slots[1].id = "heading";
    archetypes[1].slots[1].x = 1300;
    archetypes[1].slots[1].w = 200;
    expect(ExtractedArchetypesSchema.safeParse(archetypes).success).toBe(false);
  });

  it("requires both cover and content layouts", () => {
    const archetypes = validArchetypes();
    archetypes[0].category = "statement";
    expect(ExtractedArchetypesSchema.safeParse(archetypes).success).toBe(false);
  });

  it("rejects a layout containing only decorative blocks", () => {
    const archetypes = validArchetypes();
    archetypes[1].slots = archetypes[0].slots.map((slot) => ({
      ...slot,
      role: "block",
    }));
    expect(ExtractedArchetypesSchema.safeParse(archetypes).success).toBe(false);
  });

  it("rejects text styles on blocks and block styles on text", () => {
    const archetypes = validArchetypes();
    archetypes[0].slots[0].styleRef = STYLE_REF.titleTitle;
    archetypes[1].slots[0].styleRef = STYLE_REF.cardBg;
    expect(ExtractedArchetypesSchema.safeParse(archetypes).success).toBe(false);
  });
});

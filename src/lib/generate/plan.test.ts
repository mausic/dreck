import { describe, expect, it } from "vitest";

import type { ISection } from "@/lib/extract/section";
import { fallbackPlan } from "@/lib/generate/plan";
import { selectSections } from "@/lib/generate/sections";

const sections: Array<ISection> = [
  {
    id: "1",
    title: "Dosing",
    kind: "dosing",
    content: "",
    children: [
      {
        id: "1.1",
        title: "Children",
        kind: "children",
        content: "Dose table content",
      },
    ],
  },
];

describe("generation section fallback", () => {
  it("plans from substantive nested sections instead of empty roots", () => {
    expect(fallbackPlan(sections).slides[0]?.sectionIds).toEqual(["1.1"]);
  });

  it("expands an empty selected parent to substantive descendants", () => {
    expect(
      selectSections(sections, ["1"]).map((section) => section.id),
    ).toEqual(["1.1"]);
  });
});

import { describe, expect, it } from "vitest";
import type {
  ISlide,
  ISlideElement,
  ISlot,
  TSlotContent,
} from "@/lib/slides/types";
import { STYLE_REF } from "@/lib/slides/styles";
import { slotCharBudget, verifySlideFit } from "@/lib/ai/fit";

/** Element on the real `title` geometry/style (big font, two-line box ≈ 42 chars). */
function titleEl(content: TSlotContent): ISlideElement {
  return {
    id: "s--title",
    slotId: "title",
    role: "title",
    x: 120,
    y: 346,
    w: 1160,
    h: 240,
    content,
    styleRef: STYLE_REF.titleTitle,
  };
}

/** Element on the real `panel` geometry/style. */
function panelEl(content: TSlotContent): ISlideElement {
  return {
    id: "s--panel",
    slotId: "panel",
    role: "panel",
    x: 872,
    y: 88,
    w: 488,
    h: 634,
    content,
    styleRef: STYLE_REF.sidebarPanel,
  };
}

function slide(el: ISlideElement): ISlide {
  return { id: "s", archetypeId: "test", elements: [el] };
}

describe("verifySlideFit", () => {
  it("passes text that fits the box", () => {
    expect(verifySlideFit(slide(titleEl(["Dosing", "Overview"]))).ok).toBe(
      true,
    );
  });

  it("ignores thin decorative blocks", () => {
    const block: ISlideElement = {
      id: "s--rule",
      slotId: "rule",
      role: "block",
      x: 120,
      y: 300,
      w: 160,
      h: 8,
      content: "",
      styleRef: STYLE_REF.titleRule,
    };
    expect(verifySlideFit(slide(block)).ok).toBe(true);
  });

  it("flags a title that overruns its two lines", () => {
    const report = verifySlideFit(
      slide(
        titleEl(
          "An excessively long slide title that keeps going well past what the box can possibly hold on two lines",
        ),
      ),
    );
    expect(report.ok).toBe(false);
    expect(report.issues[0]).toMatchObject({ slotId: "title", role: "title" });
  });

  it("flags an overlong panel body and names the sub-region", () => {
    const report = verifySlideFit(
      slide(panelEl({ heading: "Key message", body: "word ".repeat(200) })),
    );
    expect(report.ok).toBe(false);
    expect(report.issues[0]).toMatchObject({ slotId: "panel", part: "body" });
  });
});

describe("slotCharBudget", () => {
  it("reports when a style's line box is taller than the slot", () => {
    const slot: ISlot = {
      id: "heading",
      role: "heading",
      x: 0,
      y: 0,
      w: 600,
      h: 20,
      styleRef: STYLE_REF.contentHeading,
    };
    expect(slotCharBudget(slot)).toBe("no text fits this box");
  });

  it("reports an undersized table row as unusable", () => {
    const slot: ISlot = {
      id: "row",
      role: "tableRow",
      x: 0,
      y: 0,
      w: 600,
      h: 1,
      styleRef: STYLE_REF.sidebarRow,
    };
    expect(slotCharBudget(slot)).toBe("no text fits this box");
  });

  it("gives a positive character budget for a text slot", () => {
    const slot: ISlot = {
      id: "title",
      role: "title",
      x: 0,
      y: 0,
      w: 1160,
      h: 240,
      styleRef: STYLE_REF.titleTitle,
    };
    const budget = slotCharBudget(slot);
    expect(budget).toMatch(/≤\d+ chars/);
    const max = Number(budget.match(/≤(\d+)/)?.[1]);
    expect(max).toBeGreaterThan(0);
  });

  it("gives a heading + body budget for a panel slot", () => {
    const slot: ISlot = {
      id: "panel",
      role: "panel",
      x: 0,
      y: 0,
      w: 488,
      h: 634,
      styleRef: STYLE_REF.sidebarPanel,
    };
    expect(slotCharBudget(slot)).toMatch(/heading ≤\d+ chars, body ≤\d+ chars/);
  });
});

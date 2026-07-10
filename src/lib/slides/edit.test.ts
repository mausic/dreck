import { describe, expect, it } from "vitest";
import type { ISlide, ISlideElement } from "@/lib/slides/types";
import { applyPatch, patchFromUpdates } from "@/lib/slides/edit";

/** Build an element with the given id + content; geometry/role/style are irrelevant here. */
function el(id: string, content: ISlideElement["content"]): ISlideElement {
  return {
    id,
    slotId: id,
    role: "body",
    x: 0,
    y: 0,
    w: 100,
    h: 100,
    content,
    styleRef: "",
  };
}

/** A 3-element fixture: two elements to leave untouched around one edit target. */
function slide(): ISlide {
  return {
    id: "s1",
    archetypeId: "test",
    elements: [
      el("keep-1", "left alone"),
      el("target", "edit me"),
      el("keep-2", ["untouched", "lines"]),
    ],
  };
}

describe("patchFromUpdates (structural constraints)", () => {
  it("writes content only — never geometry, role or styleRef", () => {
    const patch = patchFromUpdates(
      [{ elementId: "target", content: "new copy" }],
      new Set(["target"]),
    );
    expect(patch.target).toEqual({ content: "new copy" });
    expect(Object.keys(patch.target)).toEqual(["content"]);
  });

  it("drops updates aimed at a non-selected id", () => {
    const patch = patchFromUpdates(
      [
        { elementId: "target", content: "ok" },
        { elementId: "not-selected", content: "should be ignored" },
      ],
      new Set(["target"]),
    );
    expect(Object.keys(patch)).toEqual(["target"]);
  });

  it("carries structured content shapes through unchanged", () => {
    const patch = patchFromUpdates(
      [
        { elementId: "row", content: { label: "Dose", value: "120 mg" } },
        { elementId: "panel", content: { heading: "Note", body: "text" } },
        { elementId: "lines", content: ["one", "two"] },
      ],
      new Set(["row", "panel", "lines"]),
    );
    expect(patch.row.content).toEqual({ label: "Dose", value: "120 mg" });
    expect(patch.panel.content).toEqual({ heading: "Note", body: "text" });
    expect(patch.lines.content).toEqual(["one", "two"]);
  });
});

describe("applyPatch (immutable, isolated apply)", () => {
  it("changes only the patched element and preserves identity of the rest", () => {
    const before = slide();
    const patch = patchFromUpdates(
      [{ elementId: "target", content: "edited copy" }],
      new Set(["target"]),
    );
    const next = applyPatch(before, patch);

    // A new slide + new elements array — the originals are not mutated.
    expect(next).not.toBe(before);
    expect(next.elements).not.toBe(before.elements);

    // The targeted element is a NEW object with the patched content.
    const nextTarget = next.elements.find((e) => e.id === "target")!;
    expect(nextTarget).not.toBe(before.elements[1]);
    expect(nextTarget.content).toBe("edited copy");

    // THE ISOLATION ASSERTION: every non-selected element is the SAME reference.
    expect(next.elements[0]).toBe(before.elements[0]);
    expect(next.elements[2]).toBe(before.elements[2]);

    // And the original slide is entirely unchanged.
    expect(before.elements[1].content).toBe("edit me");
  });

  it("returns the same slide object for an empty patch", () => {
    const before = slide();
    expect(applyPatch(before, {})).toBe(before);
  });

  it("keeps the element id even if a patch tries to override it", () => {
    const before = slide();
    const next = applyPatch(before, { target: { id: "hacked", content: "x" } });
    const ids = next.elements.map((e) => e.id);
    expect(ids).toEqual(["keep-1", "target", "keep-2"]);
  });
});

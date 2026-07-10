import { describe, expect, it } from "vitest";
import type { ISlide, ISlideElement } from "@/lib/slides/types";
import { applyEdit, applyPatch } from "@/lib/slides/edit";

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

describe("applyEdit (mock transform)", () => {
  it("appends ' (edited)' by default", () => {
    const patch = applyEdit([el("target", "hello")], "make it pop");
    expect(patch.target.content).toBe("hello (edited)");
  });

  it("uppercases when the instruction mentions 'upper'", () => {
    const patch = applyEdit([el("target", "hello")], "UPPERcase this please");
    expect(patch.target.content).toBe("HELLO");
  });

  it("transforms each structured content shape", () => {
    const patch = applyEdit(
      [
        el("row", { label: "Dose", value: "120 mg" }),
        el("panel", { heading: "Note", body: "body text" }),
        el("lines", ["one", "two"]),
      ],
      "upper",
    );
    expect(patch.row.content).toEqual({ label: "DOSE", value: "120 MG" });
    expect(patch.panel.content).toEqual({ heading: "NOTE", body: "BODY TEXT" });
    expect(patch.lines.content).toEqual(["ONE", "TWO"]);
  });
});

describe("applyPatch (immutable, isolated apply)", () => {
  it("changes only the patched element and preserves identity of the rest", () => {
    const before = slide();
    const selected = [before.elements[1]]; // "target"
    const next = applyPatch(before, applyEdit(selected, "edit"));

    // A new slide + new elements array — the originals are not mutated.
    expect(next).not.toBe(before);
    expect(next.elements).not.toBe(before.elements);

    // The targeted element is a NEW object with transformed content.
    const nextTarget = next.elements.find((e) => e.id === "target")!;
    expect(nextTarget).not.toBe(before.elements[1]);
    expect(nextTarget.content).toBe("edit me (edited)");

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

import { describe, expect, it } from "vitest";
import type { ISlideElement } from "@/lib/slides/types";
import { elementsInRect, previewRectToCanonical } from "@/lib/slides/geometry";

/** Build a DOMRect-shaped object for tests (only l/t/w/h are read by the function). */
function domRect(
  left: number,
  top: number,
  width: number,
  height: number,
): DOMRect {
  return {
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
    x: left,
    y: top,
    toJSON: () => ({}),
  };
}

/** Make a canonical element box; content/role/style are irrelevant to hit-testing. */
function el(
  id: string,
  x: number,
  y: number,
  w: number,
  h: number,
): ISlideElement {
  return {
    id,
    slotId: id,
    role: "body",
    x,
    y,
    w,
    h,
    content: "",
    styleRef: "",
  };
}

describe("previewRectToCanonical", () => {
  it("maps px → canonical at scale 0.5 with the preview box at the viewport origin", () => {
    // scale 0.5 ⇒ rendered stage = 720×405, which exactly fills a 720×405 box ⇒ no letterbox.
    const preview = { rect: domRect(0, 0, 720, 405), scale: 0.5 };
    const out = previewRectToCanonical(
      { x: 100, y: 50, width: 200, height: 100 },
      preview,
    );
    expect(out).toEqual({ x: 200, y: 100, width: 400, height: 200 });
  });

  it("subtracts the preview element's top-left offset", () => {
    // Same scale, but the preview box is offset (30,20) in the viewport.
    const preview = { rect: domRect(30, 20, 720, 405), scale: 0.5 };
    const out = previewRectToCanonical(
      { x: 130, y: 70, width: 200, height: 100 },
      preview,
    );
    // Offset removed → identical canonical rect as the origin case.
    expect(out).toEqual({ x: 200, y: 100, width: 400, height: 200 });
  });

  it("subtracts the letterbox offset when the box is larger than the rendered stage", () => {
    // scale 0.5 ⇒ 720×405 stage inside an 820×505 box ⇒ 50px letterbox on each axis.
    const preview = { rect: domRect(0, 0, 820, 505), scale: 0.5 };
    const out = previewRectToCanonical(
      { x: 150, y: 100, width: 200, height: 100 },
      preview,
    );
    // (150-50)/0.5, (100-50)/0.5 → matches the no-letterbox origin case.
    expect(out).toEqual({ x: 200, y: 100, width: 400, height: 200 });
  });

  it("is scale-invariant: same drawn fraction maps identically at scale 1 and 0.25", () => {
    const atFull = previewRectToCanonical(
      { x: 300, y: 200, width: 150, height: 75 },
      { rect: domRect(0, 0, 1440, 810), scale: 1 },
    );
    expect(atFull).toEqual({ x: 300, y: 200, width: 150, height: 75 });

    const atQuarter = previewRectToCanonical(
      { x: 75, y: 50, width: 37.5, height: 18.75 },
      { rect: domRect(0, 0, 360, 202.5), scale: 0.25 },
    );
    expect(atQuarter).toEqual({ x: 300, y: 200, width: 150, height: 75 });
  });
});

describe("elementsInRect", () => {
  const box = el("target", 100, 100, 100, 100); // area 10000, center (150,150)

  it("selects an element fully inside the rect", () => {
    const hit = elementsInRect({ x: 50, y: 50, width: 200, height: 200 }, [
      box,
    ]);
    expect(hit.map((e) => e.id)).toEqual(["target"]);
  });

  it("selects on partial overlap above the threshold", () => {
    // 60×100 = 6000 of 10000 = 0.6 > 0.3.
    const hit = elementsInRect({ x: 140, y: 0, width: 200, height: 300 }, [
      box,
    ]);
    expect(hit.map((e) => e.id)).toEqual(["target"]);
  });

  it("rejects partial overlap below the threshold (center not covered)", () => {
    // 20×100 = 2000 of 10000 = 0.2 < 0.3, and center (150,150) is outside the rect.
    const hit = elementsInRect({ x: 180, y: 0, width: 200, height: 300 }, [
      box,
    ]);
    expect(hit).toEqual([]);
  });

  it("selects via the center rule even when area coverage is tiny", () => {
    // 10×10 = 100 of 10000 = 0.01 < 0.3, but the rect contains the center (150,150).
    const hit = elementsInRect({ x: 145, y: 145, width: 10, height: 10 }, [
      box,
    ]);
    expect(hit.map((e) => e.id)).toEqual(["target"]);
  });

  it("returns an empty array when the rect touches nothing", () => {
    const hit = elementsInRect({ x: 0, y: 0, width: 10, height: 10 }, [box]);
    expect(hit).toEqual([]);
  });

  it("filters a mixed set to only the elements the rect grabs", () => {
    const elements = [
      el("a", 0, 0, 100, 100),
      el("b", 500, 500, 100, 100),
      el("c", 40, 40, 100, 100),
    ];
    const hit = elementsInRect(
      { x: 0, y: 0, width: 200, height: 200 },
      elements,
    );
    // 'a' fully inside; 'c' center (90,90) inside; 'b' far away.
    expect(hit.map((e) => e.id)).toEqual(["a", "c"]);
  });
});

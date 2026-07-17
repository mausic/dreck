import { describe, expect, it } from "vitest";

import { StoredDeckSchema } from "@/lib/decks/schema";
import { DESIGN_TOKENS } from "@/lib/slides/tokens";
import { toWireSlide } from "@/lib/slides/wire";

const slide = {
  id: "slide-1",
  archetypeId: "statement",
  elements: [
    {
      id: "title",
      slotId: "title",
      role: "title" as const,
      x: 100,
      y: 100,
      w: 800,
      h: 100,
      content: "Grounded title",
      styleRef: "content/title",
    },
  ],
};

describe("stored deck validation", () => {
  it("parses persisted metadata and slide revisions", () => {
    const now = new Date();
    const result = StoredDeckSchema.parse({
      id: "00000000-0000-4000-8000-000000000001",
      prompt: "Create a concise safety deck",
      status: "complete",
      contentSourceName: "reference.pdf",
      expectedSlideCount: 1,
      generatedSlideCount: 1,
      error: null,
      createdAt: now,
      updatedAt: now,
      tokens: DESIGN_TOKENS,
      slides: [
        {
          index: 0,
          revision: 3,
          slide,
          grounding: { ok: true, issues: [] },
        },
      ],
    });

    expect(result.slides[0]).toMatchObject({ index: 0, revision: 3 });
  });

  it("rejects malformed persisted slide JSON", () => {
    expect(() =>
      StoredDeckSchema.parse({
        id: "00000000-0000-4000-8000-000000000001",
        prompt: "Deck",
        status: "complete",
        contentSourceName: "reference.pdf",
        expectedSlideCount: 1,
        generatedSlideCount: 1,
        error: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        tokens: DESIGN_TOKENS,
        slides: [{ index: 0, revision: -1, slide, grounding: null }],
      }),
    ).toThrow();
  });
});

describe("slide wire conversion", () => {
  it("preserves supported slide content", () => {
    expect(toWireSlide(slide)).toEqual(slide);
  });

  it("rejects unstructured records at the server-function boundary", () => {
    expect(() =>
      toWireSlide({
        ...slide,
        elements: [{ ...slide.elements[0], content: { arbitrary: true } }],
      }),
    ).toThrow("unsupported persisted shape");
  });
});

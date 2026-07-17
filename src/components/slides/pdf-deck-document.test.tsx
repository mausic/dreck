import { describe, expect, it } from "vitest";

import type { ISlide } from "@/lib/slides/types";
import {
  PDF_PAGE_SIZE,
  renderDeckPdfHtml,
} from "@/components/slides/pdf-deck-document";
import { DESIGN_TOKENS } from "@/lib/slides/tokens";

function slide(id: string, content: string): ISlide {
  return {
    id,
    archetypeId: "statement",
    elements: [
      {
        id: `${id}-title`,
        slotId: "title",
        role: "title",
        x: 100,
        y: 100,
        w: 900,
        h: 120,
        content,
        styleRef: "content/heading",
      },
    ],
  };
}

describe("renderDeckPdfHtml", () => {
  it("renders one ordered PDF page per slide", () => {
    const html = renderDeckPdfHtml({
      title: "Safety deck",
      slides: [slide("first", "First"), slide("second", "Second")],
      tokens: DESIGN_TOKENS,
    });

    expect(html).toMatch(/^<!doctype html>/);
    expect(html.match(/data-pdf-slide=/g)).toHaveLength(2);
    expect(html.indexOf("First")).toBeLessThan(html.indexOf("Second"));
    expect(html).toContain(
      `@page { size: ${PDF_PAGE_SIZE.width} ${PDF_PAGE_SIZE.height}; margin: 0; }`,
    );
  });

  it("embeds design tokens, supported fonts, and escaped copy", () => {
    const html = renderDeckPdfHtml({
      title: "<Safety & dosing>",
      slides: [slide("one", "5 mg < 10 mg")],
      tokens: {
        ...DESIGN_TOKENS,
        fonts: {
          display: '"Libre Franklin", sans-serif',
          body: '"IBM Plex Sans", sans-serif',
        },
      },
    });

    expect(html).toContain("fonts.googleapis.com/css2");
    expect(html).toContain("--slide-primary");
    expect(html).toContain(DESIGN_TOKENS.colors.primary);
    expect(html).toContain("&lt;Safety &amp; dosing&gt;");
    expect(html).toContain("5 mg &lt; 10 mg");
  });

  it("rejects an empty deck", () => {
    expect(() =>
      renderDeckPdfHtml({
        title: "Empty",
        slides: [],
        tokens: DESIGN_TOKENS,
      }),
    ).toThrow("at least one generated slide");
  });
});

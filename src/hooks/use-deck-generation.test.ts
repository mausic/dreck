import { describe, expect, it } from "vitest";

import type { IDeckGenerationState } from "@/hooks/use-deck-generation";
import {
  deckGenerationReducer,
  initialDeckGenerationState,
  slideNumbersFromItems,
} from "@/hooks/use-deck-generation";
import { DESIGN_TOKENS } from "@/lib/slides/tokens";

describe("deckGenerationReducer", () => {
  it("preserves failed positions and exposes a partial deck", () => {
    const planned = deckGenerationReducer(initialDeckGenerationState, {
      type: "plan",
      event: {
        type: "plan",
        deckId: "deck",
        tokens: DESIGN_TOKENS,
        plan: {
          slides: [
            { intent: "one", title: "One", sectionIds: ["1"] },
            { intent: "two", title: "Two", sectionIds: ["2"] },
          ],
        },
      },
    });
    const completed = deckGenerationReducer(planned, {
      type: "done",
      event: {
        type: "done",
        deckId: "00000000-0000-0000-0000-000000000001",
        expectedSlideCount: 2,
        generatedSlideCount: 1,
        failedIndices: [1],
        status: "partial",
      },
      slides: [{ id: "slide-1", archetypeId: "cover", elements: [] }],
    });

    expect(completed.phase).toBe("partial");
    expect(completed.items[1]?.status).toBe("error");
    expect(completed.deck?.slides).toHaveLength(1);
    expect(completed.error).toContain("1 of 2");
  });

  it("keeps original numbering when an earlier slide fails", () => {
    expect(
      slideNumbersFromItems([
        { status: "error", message: "failed" },
        {
          status: "ready",
          slide: { id: "slide-2", archetypeId: "content", elements: [] },
          grounding: { ok: true, issues: [] },
        },
      ]),
    ).toEqual({ "slide-2": 2 });
  });

  it("keeps deck edits in the canonical generation state", () => {
    const state: IDeckGenerationState = {
      ...initialDeckGenerationState,
      phase: "complete",
    };
    const deck = {
      id: "deck",
      slides: [{ id: "slide", archetypeId: "cover", elements: [] }],
    };
    const current = { ...state, deck };
    const nextSlide = { ...deck.slides[0], archetypeId: "statement" };
    const grounding = { ok: true, issues: [] };
    expect(
      deckGenerationReducer(current, {
        type: "slide-changed",
        slide: nextSlide,
        grounding,
      }).deck?.slides[0],
    ).toBe(nextSlide);
  });

  it("updates grounding alongside edited slide content", () => {
    const original = { id: "slide", archetypeId: "cover", elements: [] };
    const changed = { ...original, archetypeId: "statement" };
    const state: IDeckGenerationState = {
      ...initialDeckGenerationState,
      items: [
        {
          status: "ready",
          slide: original,
          grounding: {
            ok: false,
            issues: [{ elementId: "e", role: "body", token: "999 mg" }],
          },
        },
      ],
      deck: { id: "deck", slides: [original] },
    };

    const result = deckGenerationReducer(state, {
      type: "slide-changed",
      slide: changed,
      grounding: { ok: true, issues: [] },
    });

    expect(result.items[0]).toMatchObject({
      status: "ready",
      slide: changed,
      grounding: { ok: true },
    });
  });

  it("preserves a fatal error when partial generation completes", () => {
    const state: IDeckGenerationState = {
      ...initialDeckGenerationState,
      error: "Provider quota exhausted.",
    };
    const result = deckGenerationReducer(state, {
      type: "done",
      event: {
        type: "done",
        deckId: "deck",
        expectedSlideCount: 2,
        generatedSlideCount: 1,
        failedIndices: [1],
        status: "partial",
      },
      slides: [{ id: "slide", archetypeId: "cover", elements: [] }],
    });

    expect(result.error).toBe("Provider quota exhausted.");
  });

  it("preserves a terminal server error", () => {
    const failed = deckGenerationReducer(initialDeckGenerationState, {
      type: "failed",
      message: "Content document not found.",
    });

    expect(failed.phase).toBe("failed");
    expect(failed.error).toBe("Content document not found.");
  });
});

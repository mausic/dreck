import { describe, expect, it } from "vitest";

import type { IDeckGenerationState } from "@/hooks/use-deck-generation";
import {
  deckGenerationReducer,
  initialDeckGenerationState,
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
    expect(
      deckGenerationReducer(current, {
        type: "slide-changed",
        slide: nextSlide,
      }).deck?.slides[0],
    ).toBe(nextSlide);
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

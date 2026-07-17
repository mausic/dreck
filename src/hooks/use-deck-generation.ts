import { useReducer, useRef } from "react";

import type { IGroundingReport, TGenerationEvent } from "@/lib/generate/schema";
import type { IDeck, ISlide, ITokens } from "@/lib/slides/types";
import { generateDeck } from "@/lib/generate/deck";
import { DESIGN_TOKENS } from "@/lib/slides/tokens";

export type TGenerationPhase =
  "idle" | "generating" | "complete" | "partial" | "failed";

export type TGenerationSlot =
  | { status: "pending"; title: string }
  | { status: "ready"; slide: ISlide; grounding: IGroundingReport }
  | { status: "error"; message: string };

export interface IDeckGenerationState {
  phase: TGenerationPhase;
  error: string | null;
  items: Array<TGenerationSlot>;
  deck: IDeck | null;
  tokens: ITokens;
}

type TGenerationAction =
  | { type: "start" }
  | { type: "plan"; event: Extract<TGenerationEvent, { type: "plan" }> }
  | { type: "slide"; event: Extract<TGenerationEvent, { type: "slide" }> }
  | { type: "error"; event: Extract<TGenerationEvent, { type: "error" }> }
  | {
      type: "done";
      event: Extract<TGenerationEvent, { type: "done" }>;
      slides: Array<ISlide>;
    }
  | { type: "failed"; message: string }
  | { type: "slide-changed"; slide: ISlide };

export const initialDeckGenerationState: IDeckGenerationState = {
  phase: "idle",
  error: null,
  items: [],
  deck: null,
  tokens: DESIGN_TOKENS,
};

export function deckGenerationReducer(
  state: IDeckGenerationState,
  action: TGenerationAction,
): IDeckGenerationState {
  switch (action.type) {
    case "start":
      return { ...initialDeckGenerationState, phase: "generating" };
    case "plan":
      return {
        ...state,
        tokens: action.event.tokens,
        items: action.event.plan.slides.map((slide) => ({
          status: "pending",
          title: slide.title,
        })),
      };
    case "slide": {
      const items = state.items.slice();
      items[action.event.index] = {
        status: "ready",
        slide: action.event.slide,
        grounding: action.event.grounding,
      };
      return { ...state, items };
    }
    case "error": {
      if (action.event.index === undefined) {
        return { ...state, error: action.event.message };
      }
      const items = state.items.slice();
      items[action.event.index] = {
        status: "error",
        message: action.event.message,
      };
      return { ...state, items };
    }
    case "done": {
      const items = state.items.map((item, index) =>
        action.event.failedIndices.includes(index) && item.status === "pending"
          ? {
              status: "error" as const,
              message: "Generation did not complete.",
            }
          : item,
      );
      const phase: TGenerationPhase =
        action.event.status === "complete"
          ? "complete"
          : action.event.status === "partial"
            ? "partial"
            : "failed";
      return {
        ...state,
        phase,
        items,
        deck:
          action.slides.length > 0
            ? { id: action.event.deckId, slides: action.slides }
            : null,
        error:
          action.event.status === "partial"
            ? `${action.event.generatedSlideCount} of ${action.event.expectedSlideCount} slides were generated.`
            : state.error,
      };
    }
    case "failed":
      return { ...state, phase: "failed", error: action.message };
    case "slide-changed":
      return state.deck
        ? {
            ...state,
            deck: {
              ...state.deck,
              slides: state.deck.slides.map((slide) =>
                slide.id === action.slide.id ? action.slide : slide,
              ),
            },
          }
        : state;
  }
}

export function useDeckGeneration() {
  const [state, dispatch] = useReducer(
    deckGenerationReducer,
    initialDeckGenerationState,
  );
  const activeRun = useRef(0);

  async function generate(value: {
    contentDocId: string;
    designDocId?: string;
    prompt: string;
  }): Promise<void> {
    const runId = ++activeRun.current;
    dispatch({ type: "start" });
    const readyByIndex = new Map<number, ISlide>();
    let sawDone = false;
    let terminalMessage: string | undefined;

    try {
      const events = await generateDeck({
        data: {
          contentDocId: value.contentDocId,
          prompt: value.prompt.trim(),
          designDocId: value.designDocId || undefined,
        },
      });
      for await (const event of events) {
        if (runId !== activeRun.current) return;
        if (event.type === "plan") dispatch({ type: "plan", event });
        if (event.type === "slide") {
          readyByIndex.set(event.index, event.slide);
          dispatch({ type: "slide", event });
        }
        if (event.type === "error") {
          if (event.index === undefined) terminalMessage = event.message;
          dispatch({ type: "error", event });
        }
        if (event.type === "done") {
          sawDone = true;
          const slides = Array.from(
            { length: event.expectedSlideCount },
            (_, index) => readyByIndex.get(index),
          ).filter((slide): slide is ISlide => slide !== undefined);
          dispatch({ type: "done", event, slides });
        }
      }
      if (!sawDone) {
        dispatch({
          type: "failed",
          message: terminalMessage ?? "Generation ended unexpectedly.",
        });
      }
    } catch (error) {
      dispatch({
        type: "failed",
        message: error instanceof Error ? error.message : "Generation failed.",
      });
    }
  }

  return {
    ...state,
    generate,
    updateSlide: (slide: ISlide) => dispatch({ type: "slide-changed", slide }),
  };
}

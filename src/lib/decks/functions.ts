import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import type { TStoredDeckView } from "@/lib/decks/schema";
import { getDb } from "@/db/client";
import {
  listGeneratedDecks,
  loadGeneratedDeck,
} from "@/db/queries/decks.server";
import { toWireSlide } from "@/lib/slides/wire";

export const listRecentDecks = createServerFn({ method: "GET" }).handler(
  async () => {
    try {
      return { ok: true as const, decks: await listGeneratedDecks(getDb()) };
    } catch {
      return {
        ok: false as const,
        error: "Generated decks could not be loaded.",
      };
    }
  },
);

export const getGeneratedDeck = createServerFn({ method: "GET" })
  .validator((deckId: string) => z.uuid().parse(deckId))
  .handler(async ({ data: deckId }) => {
    try {
      const deck = await loadGeneratedDeck(getDb(), deckId);
      if (!deck) {
        return { ok: false as const, error: "Generated deck not found." };
      }
      const view: TStoredDeckView = {
        ...deck,
        slides: deck.slides.map((entry) => ({
          ...entry,
          slide: toWireSlide(entry.slide),
        })),
      };
      return { ok: true as const, deck: view };
    } catch {
      return {
        ok: false as const,
        error: "Generated deck could not be loaded.",
      };
    }
  });

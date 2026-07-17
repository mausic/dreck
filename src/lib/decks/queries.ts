import { queryOptions } from "@tanstack/react-query";

import { getGeneratedDeck, listRecentDecks } from "@/lib/decks/functions";

export const decksKeys = {
  all: ["decks"] as const,
  detail: (deckId: string) => ["decks", deckId] as const,
};

export function decksQueryOptions() {
  return queryOptions({
    queryKey: decksKeys.all,
    queryFn: async () => {
      const result = await listRecentDecks();
      if (!result.ok) throw new Error(result.error);
      return result.decks;
    },
  });
}

export function deckQueryOptions(deckId: string) {
  return queryOptions({
    queryKey: decksKeys.detail(deckId),
    queryFn: async () => {
      const result = await getGeneratedDeck({ data: deckId });
      if (!result.ok) throw new Error(result.error);
      return result.deck;
    },
  });
}

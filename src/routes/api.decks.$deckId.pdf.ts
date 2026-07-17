import { env } from "cloudflare:workers";
import { createFileRoute } from "@tanstack/react-router";

import { getDb } from "@/db/client";
import { loadGeneratedDeck } from "@/db/queries/decks.server";
import { createDeckPdfResponse } from "@/lib/decks/pdf-response";

export const Route = createFileRoute("/api/decks/$deckId/pdf")({
  server: {
    handlers: {
      POST: ({ params }) =>
        createDeckPdfResponse(params.deckId, {
          browser: env.BROWSER,
          loadDeck: (deckId) => loadGeneratedDeck(getDb(), deckId),
        }),
    },
  },
});

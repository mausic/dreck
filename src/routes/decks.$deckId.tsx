import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";

import type { IGroundingReport } from "@/lib/generate/schema";
import type { ISlide } from "@/lib/slides/types";
import type { TStoredDeckView } from "@/lib/decks/schema";
import { AppShell } from "@/components/app-shell";
import { DeckView } from "@/components/slides/deck-view";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { deckQueryOptions } from "@/lib/decks/queries";

export const Route = createFileRoute("/decks/$deckId")({
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(deckQueryOptions(params.deckId)),
  component: GeneratedDeckPage,
});

function StoredDeckWorkspace({ storedDeck }: { storedDeck: TStoredDeckView }) {
  const [slides, setSlides] = useState<
    Array<Omit<TStoredDeckView["slides"][number], "slide"> & { slide: ISlide }>
  >(storedDeck.slides);
  const deck = {
    id: storedDeck.id,
    slides: slides.map((entry) => entry.slide),
  };
  const slideNumbers = Object.fromEntries(
    slides.map((entry) => [entry.slide.id, entry.index + 1]),
  );
  const revisions = Object.fromEntries(
    slides.map((entry) => [entry.slide.id, entry.revision]),
  );
  const groundingFlags = slides.flatMap((entry) =>
    entry.grounding.ok
      ? []
      : [
          `slide ${entry.index + 1}: ${entry.grounding.issues
            .map((issue) => issue.token)
            .join(", ")}`,
        ],
  );

  function handleSlideChange(
    slide: ISlide,
    grounding: IGroundingReport,
    revision: number,
  ) {
    setSlides((current) =>
      current.map((entry) =>
        entry.slide.id === slide.id
          ? {
              ...entry,
              slide,
              grounding,
              revision,
            }
          : entry,
      ),
    );
  }

  if (slides.length === 0) {
    return (
      <div className="flex min-h-56 items-center justify-center rounded-xl border border-dashed p-8 text-center">
        <p className="text-muted-foreground text-sm">
          This deck has no generated slides to display.
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      {groundingFlags.length > 0 && (
        <p
          role="alert"
          className="border-destructive/40 text-muted-foreground rounded-md border p-3 text-xs"
        >
          Grounding flags: {groundingFlags.join(" · ")}
        </p>
      )}
      <DeckView
        deck={deck}
        tokens={storedDeck.tokens}
        slideNumbers={slideNumbers}
        initialRevisions={revisions}
        onSlideChange={handleSlideChange}
      />
    </div>
  );
}

function GeneratedDeckPage() {
  const { deckId } = Route.useParams();
  const deckQuery = useQuery(deckQueryOptions(deckId));
  const deck = deckQuery.data;
  if (!deck) return null;

  return (
    <AppShell title="Generated deck">
      <section className="flex min-h-0 flex-1 flex-col gap-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <Badge variant="outline">{deck.status}</Badge>
              <span className="text-muted-foreground text-xs">
                {deck.generatedSlideCount} of {deck.expectedSlideCount} slides
              </span>
            </div>
            <h2 className="text-lg font-semibold">{deck.prompt}</h2>
            <p className="text-muted-foreground text-sm">
              Source: {deck.contentSourceName}
            </p>
          </div>
          <Button variant="outline" render={<Link to="/decks" />}>
            Back to decks
          </Button>
        </div>

        {deck.error && (
          <p
            role="alert"
            className="border-destructive/50 text-destructive rounded-md border p-3 text-sm"
          >
            {deck.error}
          </p>
        )}

        <StoredDeckWorkspace storedDeck={deck} />
      </section>
    </AppShell>
  );
}

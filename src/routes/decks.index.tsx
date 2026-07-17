import { useQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";

import type { TDeckListItem } from "@/lib/decks/schema";
import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { decksQueryOptions } from "@/lib/decks/queries";

export const Route = createFileRoute("/decks/")({
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(decksQueryOptions()),
  component: GeneratedDecksPage,
});

const DATE_FORMAT = new Intl.DateTimeFormat("en", {
  dateStyle: "medium",
  timeZone: "UTC",
});

function statusLabel(status: TDeckListItem["status"]): string {
  return status[0].toUpperCase() + status.slice(1);
}

function GeneratedDecksPage() {
  const decksQuery = useQuery(decksQueryOptions());
  const decks = decksQuery.data ?? [];

  return (
    <AppShell title="Generated decks">
      <section className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">
              Saved decks
            </h2>
            <p className="text-muted-foreground text-sm">
              Reopen a generated deck and continue editing its persisted slides.
            </p>
          </div>
          <Button render={<Link to="/" />}>Generate new deck</Button>
        </div>

        {decks.length === 0 ? (
          <div className="flex min-h-56 flex-col items-center justify-center gap-3 rounded-xl border border-dashed p-8 text-center">
            <h3 className="font-medium">No generated decks yet</h3>
            <p className="text-muted-foreground max-w-md text-sm">
              Generate a deck from a content PDF and it will appear here.
            </p>
            <Button variant="outline" render={<Link to="/" />}>
              Generate your first deck
            </Button>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
            {decks.map((deck) => (
              <Card key={deck.id} className="min-w-0">
                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <CardTitle className="line-clamp-2 text-base">
                      {deck.prompt}
                    </CardTitle>
                    <Badge variant="outline">{statusLabel(deck.status)}</Badge>
                  </div>
                  <CardDescription className="truncate">
                    {deck.contentSourceName}
                  </CardDescription>
                </CardHeader>
                <CardContent className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 text-sm">
                  <span>
                    {deck.generatedSlideCount} of {deck.expectedSlideCount}{" "}
                    slides
                  </span>
                  <time dateTime={deck.createdAt.toISOString()}>
                    {DATE_FORMAT.format(deck.createdAt)}
                  </time>
                </CardContent>
                <CardFooter>
                  <Button
                    className="w-full"
                    variant="outline"
                    render={
                      <Link to="/decks/$deckId" params={{ deckId: deck.id }} />
                    }
                  >
                    Open deck
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </section>
    </AppShell>
  );
}

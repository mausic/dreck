import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { IconDownload, IconLoader2 } from "@tabler/icons-react";
import { toast } from "sonner";

import type { IGroundingReport } from "@/lib/generate/schema";
import type { ISlide } from "@/lib/slides/types";
import type { TStoredDeckView } from "@/lib/decks/schema";
import { AppShell } from "@/components/app-shell";
import { DeckView } from "@/components/slides/deck-view";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
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
  const [downloading, setDownloading] = useState(false);
  const downloadPendingRef = useRef(false);
  const deck = deckQuery.data;
  if (!deck) return null;

  async function handleDownload() {
    if (downloadPendingRef.current) return;
    downloadPendingRef.current = true;
    setDownloading(true);
    try {
      const response = await fetch(`/api/decks/${deckId}/pdf`, {
        method: "POST",
      });
      if (!response.ok) {
        let description = "The PDF could not be generated. Please try again.";
        try {
          const body: unknown = await response.json();
          if (
            typeof body === "object" &&
            body !== null &&
            "error" in body &&
            typeof body.error === "string"
          ) {
            description = body.error;
          }
        } catch {
          // Keep the generic message when the response is not JSON.
        }
        throw new Error(description);
      }

      const blobUrl = URL.createObjectURL(await response.blob());
      const disposition = response.headers.get("Content-Disposition");
      const filename = /filename="([^"]+)"/.exec(disposition ?? "")?.[1];
      const anchor = document.createElement("a");
      anchor.href = blobUrl;
      anchor.download = filename ?? "generated-deck.pdf";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(blobUrl), 1_000);
      toast.success("PDF download started");
    } catch (error) {
      toast.error("PDF not downloaded", {
        description:
          error instanceof Error
            ? error.message
            : "The PDF could not be generated. Please try again.",
      });
    } finally {
      downloadPendingRef.current = false;
      setDownloading(false);
    }
  }

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
          <div className="flex items-center gap-2">
            <Button
              type="button"
              disabled={downloading || deck.generatedSlideCount === 0}
              aria-busy={downloading}
              onClick={handleDownload}
            >
              {downloading ? (
                <IconLoader2
                  data-icon="inline-start"
                  className="animate-spin"
                />
              ) : (
                <IconDownload data-icon="inline-start" />
              )}
              {downloading ? "Generating PDF" : "Download PDF"}
            </Button>
            <Link
              to="/decks"
              className={buttonVariants({ variant: "outline" })}
            >
              Back to decks
            </Link>
          </div>
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

/**
 * `GeneratePanel` — the generation front of the flow, mounted on `/` above the editor.
 *
 * Pick a previously-extracted content document + type a chat prompt → `generateDeck` streams the
 * deck back one slide at a time. Each slide paints into a progressive grid the moment it lands
 * (slide 1 visible while slide 2 is still generating), and grounding flags surface out-of-band
 * (never touching the slide model). When generation finishes, the deck is handed to the existing
 * {@link DeckView}, so generated slides render and edit through the unchanged renderer/editor.
 *
 * A design document can be selected too: its extracted design system (fonts + palette) styles the
 * deck. Generation resolves those tokens server-side and streams them on the plan event, so the
 * previews and editor render with the real deck's look; with no design doc, the fallback tokens
 * are used. Only the token SOURCE changes — the renderer/editor/archetypes are unchanged.
 */
import { useEffect, useState } from "react";
import type { IDeck, ISlide, ITokens } from "@/lib/slides";
import type { IGroundingReport } from "@/lib/ai/generate-schema";
import { DEMO_DECK, PHARMA_TOKENS } from "@/lib/slides";
import {
  generateDeck,
  listRecentContentDocs,
  listRecentDesignDocs,
} from "@/lib/ai/generate-deck";
import { DeckView } from "@/components/slides/deck-view";
import { SlidePreview } from "@/components/slides/slide-preview";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";

/** Per-slide UI state as events stream in: a placeholder, a finished slide, or a failure. */
type TSlotState =
  | { status: "pending"; title: string }
  | { status: "ready"; slide: ISlide; grounding: IGroundingReport }
  | { status: "error"; message: string };

type TStatus = "idle" | "generating" | "done" | "error";
type TContentDoc = { id: string; sourceName: string };

/** One card in the progressive grid: a 16:9 preview/skeleton with an index + grounding badge. */
function SlotCard({
  index,
  state,
  tokens,
}: {
  index: number;
  state: TSlotState;
  tokens: ITokens;
}) {
  return (
    <div className="relative flex flex-col gap-1.5">
      <div className="bg-card relative aspect-[16/9] w-full overflow-hidden rounded-md border">
        {state.status === "ready" ? (
          <SlidePreview slide={state.slide} tokens={tokens} />
        ) : state.status === "error" ? (
          <div className="text-destructive flex h-full items-center justify-center p-3 text-center text-xs">
            {state.message}
          </div>
        ) : (
          <Skeleton className="h-full w-full" />
        )}
        <span className="absolute left-1.5 top-1.5 rounded bg-black/55 px-1.5 py-0.5 text-xs font-medium text-white">
          {index + 1}
        </span>
        {state.status === "ready" && !state.grounding.ok && (
          <Badge
            variant="destructive"
            className="absolute right-1.5 top-1.5 text-[10px]"
          >
            {state.grounding.issues.length} ungrounded
          </Badge>
        )}
      </div>
      <p className="text-muted-foreground truncate text-xs">
        {state.status === "pending"
          ? state.title || "Generating…"
          : state.status === "error"
            ? "Failed"
            : " "}
      </p>
    </div>
  );
}

export function GeneratePanel() {
  const [docs, setDocs] = useState<Array<TContentDoc>>([]);
  const [contentDocId, setContentDocId] = useState("");
  const [designDocs, setDesignDocs] = useState<Array<TContentDoc>>([]);
  const [designDocId, setDesignDocId] = useState("");
  const [prompt, setPrompt] = useState("");
  const [status, setStatus] = useState<TStatus>("idle");
  const [topError, setTopError] = useState<string | null>(null);
  const [items, setItems] = useState<Array<TSlotState>>([]);
  const [doneDeck, setDoneDeck] = useState<IDeck | null>(null);
  // The design tokens the deck is styled with — set from the plan event (the extracted design
  // system), falling back to the placeholder tokens until then / when no design doc is chosen.
  const [tokens, setTokens] = useState<ITokens>(PHARMA_TOKENS);

  // Load recent content + design documents for the pickers.
  useEffect(() => {
    let active = true;
    listRecentContentDocs()
      .then((res) => {
        if (!active || !res.ok) return;
        setDocs(res.docs);
        setContentDocId((prev) => prev || res.docs[0]?.id || "");
      })
      .catch(() => {
        /* soft — the picker just stays empty */
      });
    listRecentDesignDocs()
      .then((res) => {
        if (!active || !res.ok) return;
        setDesignDocs(res.docs);
        setDesignDocId((prev) => prev || res.docs[0]?.id || "");
      })
      .catch(() => {
        /* soft — design is optional; falls back to placeholder tokens */
      });
    return () => {
      active = false;
    };
  }, []);

  async function handleGenerate(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = prompt.trim();
    if (!contentDocId || !trimmed || status === "generating") return;

    setStatus("generating");
    setTopError(null);
    setDoneDeck(null);
    setItems([]);
    setTokens(PHARMA_TOKENS);

    const readyByIndex = new Map<number, ISlide>();
    let sawDone = false;

    try {
      const events = await generateDeck({
        data: {
          contentDocId,
          prompt: trimmed,
          designDocId: designDocId || undefined,
        },
      });
      for await (const ev of events) {
        if (ev.type === "plan") {
          setTokens(ev.tokens);
          setItems(
            ev.plan.slides.map((s) => ({ status: "pending", title: s.title })),
          );
        } else if (ev.type === "slide") {
          readyByIndex.set(ev.index, ev.slide);
          setItems((prev) => {
            const next = prev.slice();
            next[ev.index] = {
              status: "ready",
              slide: ev.slide,
              grounding: ev.grounding,
            };
            return next;
          });
        } else if (ev.type === "error") {
          if (typeof ev.index === "number") {
            const at = ev.index;
            setItems((prev) => {
              const next = prev.slice();
              next[at] = { status: "error", message: ev.message };
              return next;
            });
          } else {
            setTopError(ev.message);
          }
        } else {
          // Only the "done" variant remains.
          sawDone = true;
          const ordered = Array.from({ length: ev.slideCount }, (_, i) =>
            readyByIndex.get(i),
          ).filter((s): s is ISlide => s !== undefined);
          setDoneDeck({ id: ev.deckId, slides: ordered });
          setStatus(ordered.length > 0 ? "done" : "error");
        }
      }
      if (!sawDone) setStatus("error");
    } catch (error) {
      setTopError(
        error instanceof Error ? error.message : "Generation failed.",
      );
      setStatus("error");
    }
  }

  const isGenerating = status === "generating";
  const editorDeck = doneDeck ?? DEMO_DECK;
  const flagged = items.flatMap((it, i) =>
    it.status === "ready" && !it.grounding.ok
      ? [{ index: i, tokens: it.grounding.issues.map((x) => x.token) }]
      : [],
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <section className="flex flex-col gap-4 rounded-lg border p-4">
        <div>
          <h2 className="text-sm font-semibold">Generate slides</h2>
          <p className="text-muted-foreground text-sm">
            Pick an extracted content document, describe the deck, and slides
            stream in as they’re generated.
          </p>
        </div>

        <form
          onSubmit={handleGenerate}
          className="flex flex-wrap items-end gap-4"
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="content-doc">Content document</Label>
            <select
              id="content-doc"
              value={contentDocId}
              onChange={(e) => setContentDocId(e.target.value)}
              className="border-input bg-background h-9 min-w-56 rounded-md border px-3 text-sm"
            >
              {docs.length === 0 && (
                <option value="">(none — extract one first)</option>
              )}
              {docs.map((doc) => (
                <option key={doc.id} value={doc.id}>
                  {doc.sourceName} · {doc.id.slice(0, 8)}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="design-doc">Design (optional)</Label>
            <select
              id="design-doc"
              value={designDocId}
              onChange={(e) => setDesignDocId(e.target.value)}
              className="border-input bg-background h-9 min-w-56 rounded-md border px-3 text-sm"
            >
              <option value="">Default tokens</option>
              {designDocs.map((doc) => (
                <option key={doc.id} value={doc.id}>
                  {doc.sourceName} · {doc.id.slice(0, 8)}
                </option>
              ))}
            </select>
          </div>
          <div className="flex min-w-72 flex-1 flex-col gap-1.5">
            <Label htmlFor="prompt">Prompt</Label>
            <Input
              id="prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="e.g. a deck on the dosing, presentations and safety of the product"
            />
          </div>
          <Button
            type="submit"
            disabled={!contentDocId || !prompt.trim() || isGenerating}
          >
            {isGenerating ? "Generating…" : "Generate"}
          </Button>
        </form>

        {topError && (
          <p className="border-destructive/50 text-destructive rounded-md border p-3 text-sm">
            {topError}
          </p>
        )}

        {flagged.length > 0 && (
          <p className="border-destructive/40 text-muted-foreground rounded-md border p-3 text-xs">
            Grounding flags (kept, not dropped) —{" "}
            {flagged
              .map((f) => `slide ${f.index + 1}: ${f.tokens.join(", ")}`)
              .join(" · ")}
          </p>
        )}

        {items.length > 0 && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {items.map((state, i) => (
              <SlotCard key={i} index={i} state={state} tokens={tokens} />
            ))}
          </div>
        )}
      </section>

      {/* During generation the progressive grid is the view; otherwise the full editor. Keyed by
          deck id so the editor mounts fresh when a generated deck replaces the placeholder. */}
      {!isGenerating && (
        <DeckView key={editorDeck.id} deck={editorDeck} tokens={tokens} />
      )}
    </div>
  );
}

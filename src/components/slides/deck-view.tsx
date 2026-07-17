import { useState } from "react";
import type { IDeck, ISlide, ITokens } from "@/lib/slides";
import { SlidePreview } from "@/components/slides/slide-preview";
import { SlideEditor } from "@/components/slides/slide-editor";
import { cn } from "@/lib/utils";

export interface IDeckViewProps {
  deck: IDeck;
  tokens: ITokens;
  onSlideChange: (slide: ISlide) => void;
}

export function DeckView({ deck, tokens, onSlideChange }: IDeckViewProps) {
  const [selectedId, setSelectedId] = useState(deck.slides[0]?.id ?? "");
  const [revisions, setRevisions] = useState<Record<string, number>>({});

  if (deck.slides.length === 0) return null;
  const selected =
    deck.slides.find((slide) => slide.id === selectedId) ?? deck.slides[0];

  /** Advance the local revision and update the canonical deck through the parent reducer. */
  function handleSlideChange(next: ISlide, revision: number) {
    setRevisions((current) => ({ ...current, [next.id]: revision }));
    onSlideChange(next);
  }

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col gap-4 xl:flex-row xl:gap-6">
      <nav
        aria-label="Slides"
        className="flex shrink-0 gap-3 overflow-x-auto pb-1 xl:w-52 xl:flex-col xl:overflow-y-auto xl:pr-1"
      >
        {deck.slides.map((slide, index) => {
          const isActive = slide.id === selected.id;
          return (
            <button
              key={slide.id}
              type="button"
              onClick={() => setSelectedId(slide.id)}
              aria-current={isActive}
              aria-label={`Slide ${index + 1}`}
              className={cn(
                "relative aspect-video w-40 shrink-0 overflow-hidden rounded-md border-2 bg-card transition-colors xl:w-full",
                isActive
                  ? "border-primary"
                  : "border-transparent hover:border-border",
              )}
            >
              <SlidePreview slide={slide} tokens={tokens} />
              <span className="absolute left-1.5 top-1.5 rounded bg-black/55 px-1.5 py-0.5 text-xs font-medium text-white">
                {index + 1}
              </span>
            </button>
          );
        })}
      </nav>

      <SlideEditor
        key={selected.id}
        deckId={deck.id}
        slide={selected}
        revision={revisions[selected.id] ?? 0}
        tokens={tokens}
        onChange={handleSlideChange}
      />
    </div>
  );
}

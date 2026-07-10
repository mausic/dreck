import { useState } from "react";
import type { IDeck, ISlide, ITokens } from "@/lib/slides";
import { SlidePreview } from "@/components/slides/slide-preview";
import { SlideEditor } from "@/components/slides/slide-editor";
import { cn } from "@/lib/utils";

export interface IDeckViewProps {
  deck: IDeck;
  tokens: ITokens;
}

/**
 * Deck workspace: a thumbnail rail (static {@link SlidePreview}s) beside the
 * {@link SlideEditor} for the selected slide. The deck is held in state so region
 * edits persist per slide as the user navigates; edits are applied immutably at the
 * deck level (only the edited slide object is replaced).
 */
export function DeckView({ deck: initialDeck, tokens }: IDeckViewProps) {
  const [deck, setDeck] = useState(initialDeck);
  const [selectedId, setSelectedId] = useState(initialDeck.slides[0]?.id ?? "");

  if (deck.slides.length === 0) return null;
  const selected =
    deck.slides.find((slide) => slide.id === selectedId) ?? deck.slides[0];

  function handleSlideChange(next: ISlide) {
    setDeck((current) => ({
      ...current,
      slides: current.slides.map((slide) =>
        slide.id === next.id ? next : slide,
      ),
    }));
  }

  return (
    <div className="flex h-full min-h-0 flex-1 gap-6">
      <nav
        aria-label="Slides"
        className="flex w-52 shrink-0 flex-col gap-3 overflow-y-auto pr-1"
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
                "relative aspect-[16/9] w-full overflow-hidden rounded-md border-2 bg-card transition-colors",
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

      {/* Keyed by slide id so switching slides resets the editor's selection. */}
      <SlideEditor
        key={selected.id}
        slide={selected}
        tokens={tokens}
        onChange={handleSlideChange}
      />
    </div>
  );
}

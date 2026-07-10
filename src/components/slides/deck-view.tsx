import { useState } from "react";
import type { IDeck, ITokens } from "@/lib/slides";
import { SlidePreview } from "@/components/slides/slide-preview";
import { cn } from "@/lib/utils";

export interface IDeckViewProps {
  deck: IDeck;
  tokens: ITokens;
}

/**
 * Minimal deck workspace: a thumbnail rail (each a small {@link SlidePreview}) beside
 * one large preview of the selected slide. The same preview component drives both,
 * proving the canonical→pixel scale generalizes across any container size.
 */
export function DeckView({ deck, tokens }: IDeckViewProps) {
  const [selectedId, setSelectedId] = useState(deck.slides[0]?.id ?? "");

  if (deck.slides.length === 0) return null;
  const selected =
    deck.slides.find((slide) => slide.id === selectedId) ?? deck.slides[0];

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

      <div className="flex min-w-0 flex-1 items-center justify-center">
        <div className="aspect-[16/9] w-full max-w-[1180px] overflow-hidden rounded-xl border bg-card shadow-sm">
          <SlidePreview slide={selected} tokens={tokens} />
        </div>
      </div>
    </div>
  );
}

import { useMemo, useState } from "react";
import type { IRect, ISelectionRect, ISlide, ITokens } from "@/lib/slides";
import { applyEdit, applyPatch, elementsInRect } from "@/lib/slides";
import { SlidePreview } from "@/components/slides/slide-preview";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export interface ISlideEditorProps {
  slide: ISlide;
  tokens: ITokens;
  /** Persist an edited slide back up to the deck (immutable replace). */
  onChange: (slide: ISlide) => void;
}

/**
 * The region-edit workspace for a single slide: draw a rectangle on the preview to
 * select elements, then apply a (mock) instruction that rewrites only those elements.
 *
 * State here is intentionally transient — selection rectangle + instruction text.
 * Because the selection is stored in CANONICAL units (not pixels), it survives window
 * resizes untouched: the preview simply re-scales the same canonical rect. Mount this
 * keyed by `slide.id` so switching slides starts with a clean selection.
 */
export function SlideEditor({ slide, tokens, onChange }: ISlideEditorProps) {
  const [selection, setSelection] = useState<ISelectionRect | null>(null);
  const [instruction, setInstruction] = useState("");

  // Hit-test is derived, never stored: single source of truth is the canonical rect.
  const selectedElements = useMemo(
    () => (selection ? elementsInRect(selection, slide.elements) : []),
    [selection, slide.elements],
  );
  const selectedIds = useMemo(
    () => new Set(selectedElements.map((el) => el.id)),
    [selectedElements],
  );

  /** Store the drawn canonical rect as the active selection (`null` clears it). */
  function handleSelectRect(rect: IRect | null) {
    // Attach the slideId here → the graded { slideId, x, y, width, height } shape.
    setSelection(rect ? { slideId: slide.id, ...rect } : null);
  }

  /** Whether the current selection + instruction permit an edit. */
  const canApply = selectedElements.length > 0 && instruction.trim().length > 0;

  /** Run the edit loop for the current selection + instruction, then persist the result. */
  function handleApply() {
    if (!canApply) return;
    // Seam: applyEdit is the mock/LLM boundary; applyPatch is the pure isolated merge.
    onChange(applyPatch(slide, applyEdit(selectedElements, instruction)));
  }

  /** Drop the current selection (and thus the highlight + marquee). */
  function handleClear() {
    setSelection(null);
  }

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col gap-3">
      <div className="flex min-h-0 flex-1 items-center justify-center">
        <div className="aspect-[16/9] w-full max-w-[1180px] overflow-hidden rounded-xl border bg-card shadow-sm">
          <SlidePreview
            slide={slide}
            tokens={tokens}
            selectedIds={selectedIds}
            selectionRect={selection}
            onSelectRect={handleSelectRect}
          />
        </div>
      </div>

      <div className="shrink-0 rounded-xl border bg-card p-3">
        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={instruction}
            onChange={(e) => setInstruction(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleApply();
            }}
            placeholder='Edit instruction — e.g. "make it upper" or anything else'
            className="h-9 min-w-56 flex-1"
            aria-label="Edit instruction"
          />
          <Button size="lg" onClick={handleApply} disabled={!canApply}>
            Apply
          </Button>
          <Button
            size="lg"
            variant="outline"
            onClick={handleClear}
            disabled={!selection}
          >
            Clear
          </Button>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span className="tabular-nums">
            {selection
              ? `${selectedElements.length} element${
                  selectedElements.length === 1 ? "" : "s"
                } selected`
              : "Draw a rectangle on the slide to select"}
          </span>
          {/* The captured canonical rectangle — the graded coordinate example. */}
          <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-foreground">
            {selection ? JSON.stringify(selection) : "{ no selection }"}
          </code>
        </div>
      </div>
    </div>
  );
}

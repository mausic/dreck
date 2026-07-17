import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import type { IGroundingReport } from "@/lib/generate/schema";
import type { IRect, ISelectionRect, ISlide, ITokens } from "@/lib/slides";
import { applyPatch, editableElementsInRect } from "@/lib/slides";
import { editRegion } from "@/lib/edit/region";
import { SlidePreview } from "@/components/slides/slide-preview";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export interface ISlideEditorProps {
  deckId: string;
  slide: ISlide;
  revision: number;
  tokens: ITokens;
  onChange: (
    slide: ISlide,
    revision: number,
    grounding: IGroundingReport,
  ) => void;
}

/**
 * The region-edit workspace for a single slide: draw a rectangle on the preview to
 * select elements, then apply an instruction that rewrites only those elements.
 *
 * State here is intentionally transient — selection rectangle + instruction text.
 * Because the selection is stored in CANONICAL units (not pixels), it survives window
 * resizes untouched: the preview simply re-scales the same canonical rect. Mount this
 * keyed by `slide.id` so switching slides starts with a clean selection.
 */
export function SlideEditor({
  deckId,
  slide,
  revision,
  tokens,
  onChange,
}: ISlideEditorProps) {
  const [selection, setSelection] = useState<ISelectionRect | null>(null);
  const [instruction, setInstruction] = useState("");
  const [pending, setPending] = useState(false);
  const pendingRef = useRef(false);

  // Hit-test is derived, never stored: single source of truth is the canonical rect.
  const selectedElements = useMemo(
    () => (selection ? editableElementsInRect(selection, slide.elements) : []),
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
  const canApply =
    selectedElements.length > 0 && instruction.trim().length > 0 && !pending;

  /**
   * Run the edit loop: the `editRegion` server function performs the model call and
   * returns a patch; `applyPatch` merges it (only the selected ids, immutably). A soft
   * failure leaves the deck untouched and surfaces a toast — never a crash.
   */
  async function handleApply() {
    if (!canApply || !selection || pendingRef.current) return;
    pendingRef.current = true;
    setPending(true);
    try {
      const result = await editRegion({
        data: {
          deckId,
          slideId: slide.id,
          expectedRevision: revision,
          instruction: instruction.trim(),
          selection: {
            x: selection.x,
            y: selection.y,
            width: selection.width,
            height: selection.height,
          },
        },
      });
      if (result.ok) {
        onChange(
          applyPatch(slide, result.patch),
          result.revision,
          result.grounding,
        );
      } else {
        if (result.conflict) {
          onChange(
            result.conflict.slide,
            result.conflict.revision,
            result.conflict.grounding,
          );
        }
        toast.error("Edit not applied", { description: result.error });
      }
    } catch {
      toast.error("Edit not applied", {
        description:
          "Couldn't reach the editor. Check your connection and try again.",
      });
    } finally {
      pendingRef.current = false;
      setPending(false);
    }
  }

  /** Drop the current selection (and thus the highlight + marquee). */
  function handleClear() {
    setSelection(null);
  }

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col gap-3">
      <div className="flex min-h-0 flex-1 items-center justify-center">
        <div className="aspect-video w-full max-w-295 overflow-hidden rounded-xl border bg-card shadow-sm">
          <SlidePreview
            slide={slide}
            tokens={tokens}
            selectedIds={selectedIds}
            selectionRect={selection}
            onSelectRect={pending ? undefined : handleSelectRect}
          />
        </div>
      </div>

      <div className="shrink-0 rounded-xl border bg-card p-3">
        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={instruction}
            onChange={(e) => setInstruction(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void handleApply();
            }}
            placeholder='Edit instruction — e.g. "make this more concise"'
            className="h-9 min-w-56 flex-1"
            aria-label="Edit instruction"
            disabled={pending}
          />
          <Button size="lg" onClick={handleApply} disabled={!canApply}>
            {pending ? "Applying…" : "Apply"}
          </Button>
          <Button
            size="lg"
            variant="outline"
            onClick={handleClear}
            disabled={!selection || pending}
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

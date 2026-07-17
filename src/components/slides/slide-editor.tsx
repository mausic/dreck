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

export function SlideEditor({
  deckId,
  slide,
  revision,
  tokens,
  onChange,
}: ISlideEditorProps) {
  const [selection, setSelection] = useState<ISelectionRect | null>(null);
  const [selectedElementId, setSelectedElementId] = useState("");
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
    setSelectedElementId("");
    // Attach the slideId here → the graded { slideId, x, y, width, height } shape.
    setSelection(rect ? { slideId: slide.id, ...rect } : null);
  }

  function handleElementSelect(elementId: string) {
    setSelectedElementId(elementId);
    const element = slide.elements.find(
      (candidate) => candidate.id === elementId,
    );
    setSelection(
      element
        ? {
            slideId: slide.id,
            x: element.x,
            y: element.y,
            width: element.w,
            height: element.h,
          }
        : null,
    );
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
    setSelectedElementId("");
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
          <label className="sr-only" htmlFor={`element-select-${slide.id}`}>
            Select an editable slide element
          </label>
          <select
            id={`element-select-${slide.id}`}
            value={selectedElementId}
            onChange={(event) => handleElementSelect(event.currentTarget.value)}
            disabled={pending}
            className="border-input bg-background h-9 max-w-full rounded-md border px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <option value="">Select element by keyboard…</option>
            {slide.elements
              .filter((element) => element.role !== "block")
              .map((element, index) => (
                <option key={element.id} value={element.id}>
                  {element.role} {index + 1}
                </option>
              ))}
          </select>
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

        <div
          aria-live="polite"
          className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground"
        >
          <span className="tabular-nums">
            {selection
              ? `${selectedElements.length} element${
                  selectedElements.length === 1 ? "" : "s"
                } selected`
              : "Draw a rectangle on the slide to select"}
          </span>
        </div>
      </div>
    </div>
  );
}

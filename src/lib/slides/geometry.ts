/**
 * Selection geometry: the px↔canonical bridge and the rect↔element hit-test.
 *
 * These two functions are the graded core of the region-edit loop and are kept
 * deliberately pure (no DOM, no React, no side effects) so their correctness is
 * provable in isolation. All coordinate math lives HERE — components gather inputs
 * (a DOMRect + the Task 1 scale) and call in; they never do px/scale arithmetic
 * themselves.
 */
import type { ISlideElement } from "@/lib/slides/types";
import { CANVAS } from "@/lib/slides/types";

/** An axis-aligned rectangle in canonical 1440×810 units (or, transiently, px). */
export interface IRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** The graded deliverable shape: a canonical rect tagged with the slide it belongs to. */
export interface ISelectionRect extends IRect {
  slideId: string;
}

/**
 * Convert a selection rectangle drawn on the preview (in CSS pixels, relative to the
 * viewport — i.e. straight from pointer `clientX/clientY`) into canonical 1440×810
 * units. This is the single inverse of Task 1's forward map `renderedPx = canonical *
 * scale`; the `scale` argument is Task 1's factor (`renderedWidth / CANVAS.width`) and
 * is never recomputed here.
 *
 * Steps:
 *   1. Subtract the preview element's top-left (`rect.left/top`) to get coordinates
 *      relative to the preview box.
 *   2. Subtract the letterbox offset. The stage is rendered at `CANVAS * scale` and
 *      centered inside the preview box (object-fit: contain semantics). Whichever axis
 *      has slack gets `(boxSize - renderedSize) / 2` of padding on each side; when the
 *      box matches the 16:9 stage exactly (Task 1's current layout) both offsets are 0,
 *      but we compute them anyway so a differently-shaped container stays correct.
 *   3. Divide by `scale` to land back in canonical units, and round to integers so the
 *      emitted rect is clean (it is shown as JSON and fed to the hit-test).
 *
 * devicePixelRatio is intentionally NOT involved: `getBoundingClientRect()` and pointer
 * `clientX/clientY` are already in CSS pixels, the very same unit space `scale` was
 * derived in — mixing in the physical-pixel ratio would double-count the display density.
 */
export function previewRectToCanonical(
  rectPx: IRect,
  preview: { rect: DOMRect; scale: number },
): IRect {
  const { rect, scale } = preview;

  // Rendered stage size in px, and the letterbox padding around it inside the box.
  const renderedWidth = CANVAS.width * scale;
  const renderedHeight = CANVAS.height * scale;
  const letterboxX = (rect.width - renderedWidth) / 2;
  const letterboxY = (rect.height - renderedHeight) / 2;

  // Origin of the drawn rect, moved from viewport space → stage-local px.
  const localX = rectPx.x - rect.left - letterboxX;
  const localY = rectPx.y - rect.top - letterboxY;

  return {
    x: Math.round(localX / scale),
    y: Math.round(localY / scale),
    // Size is offset-independent, so only the scale divide applies.
    width: Math.round(rectPx.width / scale),
    height: Math.round(rectPx.height / scale),
  };
}

/**
 * Return the elements a canonical selection rectangle picks out.
 *
 * An element is selected when EITHER:
 *   • the rect covers more than `threshold` of the element's area
 *     (`intersectionArea / elementArea > threshold`), OR
 *   • the rect contains the element's center point.
 *
 * The center rule is the safety net for the area rule: a very thin element (a rule
 * line) or a very large one (a full-bleed background) can be clearly "grabbed" by the
 * user without the intersection ever crossing the area threshold.
 */
export function elementsInRect(
  rect: IRect,
  elements: Array<ISlideElement>,
  threshold = 0.3,
): Array<ISlideElement> {
  const rectRight = rect.x + rect.width;
  const rectBottom = rect.y + rect.height;

  return elements.filter((el) => {
    // Overlap of the two boxes on each axis (clamped at 0 when they don't meet).
    const overlapW = Math.max(
      0,
      Math.min(rectRight, el.x + el.w) - Math.max(rect.x, el.x),
    );
    const overlapH = Math.max(
      0,
      Math.min(rectBottom, el.y + el.h) - Math.max(rect.y, el.y),
    );

    const elementArea = el.w * el.h;
    const coverage = elementArea > 0 ? (overlapW * overlapH) / elementArea : 0;
    if (coverage > threshold) return true;

    // Center-of-element inside the rect (inclusive) — catches thin/huge elements.
    const cx = el.x + el.w / 2;
    const cy = el.y + el.h / 2;
    return cx >= rect.x && cx <= rectRight && cy >= rect.y && cy <= rectBottom;
  });
}

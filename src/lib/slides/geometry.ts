import type { ISlideElement } from "@/lib/slides/types";
import { CANVAS } from "@/lib/slides/types";

export interface IRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ISelectionRect extends IRect {
  slideId: string;
}

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

  // Origin of the drawn rect in px, relative to the top-left of the rendered stage (not the viewport).
  const localX = rectPx.x - rect.left - letterboxX;
  const localY = rectPx.y - rect.top - letterboxY;

  const x = Math.max(0, Math.round(localX / scale));
  const y = Math.max(0, Math.round(localY / scale));
  const right = Math.min(
    CANVAS.width,
    Math.round((localX + rectPx.width) / scale),
  );
  const bottom = Math.min(
    CANVAS.height,
    Math.round((localY + rectPx.height) / scale),
  );

  return {
    x,
    y,
    width: Math.max(0, right - x),
    height: Math.max(0, bottom - y),
  };
}

export function elementsInRect(
  rect: IRect,
  elements: Array<ISlideElement>,
  threshold = 0.3,
): Array<ISlideElement> {
  const rectRight = rect.x + rect.width;
  const rectBottom = rect.y + rect.height;

  return elements.filter((el) => {
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

    const cx = el.x + el.w / 2;
    const cy = el.y + el.h / 2;
    return cx >= rect.x && cx <= rectRight && cy >= rect.y && cy <= rectBottom;
  });
}

export function editableElementsInRect(
  rect: IRect,
  elements: Array<ISlideElement>,
  threshold = 0.3,
): Array<ISlideElement> {
  return elementsInRect(rect, elements, threshold).filter(
    (element) => element.role !== "block",
  );
}

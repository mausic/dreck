import { useState } from "react";
import type { CSSProperties, PointerEvent } from "react";
import type { IRect, ISlide, ITokens } from "@/lib/slides";
import { CANVAS, previewRectToCanonical } from "@/lib/slides";
import { useCanvasScale } from "@/hooks/use-canvas-scale";
import { SlideElementView } from "@/components/slides/slide-element";
import { cn } from "@/lib/utils";

export interface ISlidePreviewProps {
  slide: ISlide;
  tokens: ITokens;
  className?: string;
  /** Ids of elements currently hit by the selection — drawn with a highlight ring. */
  selectedIds?: ReadonlySet<string>;
  /** The committed selection rectangle in CANONICAL units, drawn as a marquee. */
  selectionRect?: IRect | null;
  /**
   * Enables rectangle drawing. Called on pointer-up with the drawn region mapped to
   * canonical units (via {@link previewRectToCanonical}), or `null` for a click/tiny
   * drag = "clear". Presence of this handler is what makes the preview interactive;
   * thumbnails omit it and stay static.
   */
  onSelectRect?: (rect: IRect | null) => void;
}

/** A drag in progress, in container-local px (relative to the fit-container's top-left). */
interface IDrag {
  sx: number;
  sy: number;
  cx: number;
  cy: number;
}

/** Normalize two corners into a positive-size rect. */
function normalize(ax: number, ay: number, bx: number, by: number): IRect {
  return {
    x: Math.min(ax, bx),
    y: Math.min(ay, by),
    width: Math.abs(bx - ax),
    height: Math.abs(by - ay),
  };
}

export function SlidePreview({
  slide,
  tokens,
  className,
  selectedIds,
  selectionRect,
  onSelectRect,
}: ISlidePreviewProps) {
  const { ref, scale, rendered, ready } = useCanvasScale<HTMLDivElement>();
  const [drag, setDrag] = useState<IDrag | null>(null);
  const interactive = Boolean(onSelectRect);

  const tokenVars = {
    "--slide-primary": tokens.colors.primary,
    "--slide-surface": tokens.colors.surface,
    "--slide-accent": tokens.colors.accent,
    "--slide-white": tokens.colors.white,
    "--slide-text-dark": tokens.colors.textDark,
    "--slide-text-muted": tokens.colors.textMuted,
    "--slide-font-display": tokens.fonts.display,
    "--slide-font-body": tokens.fonts.body,
  } satisfies Record<string, string>;

  const stageStyle = {
    position: "absolute",
    top: 0,
    left: 0,
    width: CANVAS.width,
    height: CANVAS.height,
    transform: `scale(${scale})`,
    transformOrigin: "top left",
    background: "var(--slide-white)",
    color: "var(--slide-text-dark)",
    fontFamily: "var(--slide-font-body)",
    overflow: "hidden",
    ...tokenVars,
  } as CSSProperties;

  /** Pointer position relative to the preview container's top-left, in CSS px. */
  function localPoint(event: PointerEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  /** Begin a drag: capture the pointer and record the start corner. */
  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    if (!interactive || scale <= 0 || event.button !== 0 || !event.isPrimary)
      return;
    // Capture keeps move/up firing if the pointer leaves the box mid-drag. It can throw
    // for an inactive pointer id — that's non-fatal, so never let it abort the drag.
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      /* ignore — capture is a nicety, not required for correctness */
    }
    const p = localPoint(event);
    setDrag({ sx: p.x, sy: p.y, cx: p.x, cy: p.y });
  }

  /** Track the moving corner while a drag is in progress. */
  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!drag) return;
    const p = localPoint(event);
    setDrag((d) => (d ? { ...d, cx: p.x, cy: p.y } : d));
  }

  /** End a drag: map the drawn box to canonical units, or clear on a click/tiny drag. */
  function handlePointerUp(event: PointerEvent<HTMLDivElement>) {
    if (!drag) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const end = localPoint(event);
    const local = normalize(drag.sx, drag.sy, end.x, end.y);
    setDrag(null);

    // A click or a negligible drag clears the selection.
    if (local.width < 4 && local.height < 4) {
      onSelectRect?.(null);
      return;
    }
    // Shift local px back to viewport space (what the pure mapper expects), then map.
    const viewportRect: IRect = {
      x: local.x + rect.left,
      y: local.y + rect.top,
      width: local.width,
      height: local.height,
    };
    const canonical = previewRectToCanonical(viewportRect, { rect, scale });
    onSelectRect?.(
      canonical.width > 0 && canonical.height > 0 ? canonical : null,
    );
  }

  const liveOverlay = drag
    ? normalize(drag.sx, drag.sy, drag.cx, drag.cy)
    : null;

  return (
    <div
      ref={ref}
      className={cn("relative h-full w-full overflow-hidden", className)}
      style={
        interactive
          ? { cursor: "crosshair", touchAction: "none", userSelect: "none" }
          : undefined
      }
      onPointerDown={interactive ? handlePointerDown : undefined}
      onPointerMove={interactive ? handlePointerMove : undefined}
      onPointerUp={interactive ? handlePointerUp : undefined}
      onPointerCancel={interactive ? () => setDrag(null) : undefined}
    >
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          width: rendered.width,
          height: rendered.height,
          transform: "translate(-50%, -50%)",
          visibility: ready ? "visible" : "hidden",
        }}
      >
        <div style={stageStyle}>
          {slide.elements.map((element) => (
            <SlideElementView
              key={element.id}
              element={element}
              selected={selectedIds?.has(element.id)}
            />
          ))}

          {selectionRect ? (
            <div
              aria-hidden
              style={{
                position: "absolute",
                left: selectionRect.x,
                top: selectionRect.y,
                width: selectionRect.width,
                height: selectionRect.height,
                border: "2px dashed #2563eb",
                background: "color-mix(in srgb, #2563eb 6%, transparent)",
                pointerEvents: "none",
              }}
            />
          ) : null}
        </div>
      </div>

      {liveOverlay ? (
        <div
          aria-hidden
          style={{
            position: "absolute",
            left: liveOverlay.x,
            top: liveOverlay.y,
            width: liveOverlay.width,
            height: liveOverlay.height,
            border: "2px solid #2563eb",
            background: "color-mix(in srgb, #2563eb 12%, transparent)",
            pointerEvents: "none",
          }}
        />
      ) : null}
    </div>
  );
}

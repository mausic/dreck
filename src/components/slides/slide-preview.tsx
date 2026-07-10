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

/**
 * Renders one slide as a canonical 1440×810 stage scaled to fill its container,
 * aspect-ratio locked. The active tokens are written as `--slide-*` CSS custom
 * properties on the stage, so element style presets (which reference those vars)
 * restyle instantly when the tokens change.
 *
 * When `onSelectRect` is supplied the preview becomes an interactive selection
 * surface: the user drags a rectangle, a live overlay tracks the pointer, and on
 * release the region is handed to {@link previewRectToCanonical}. The scale it inverts
 * is owned by {@link useCanvasScale} — the single seam shared with rendering, so a
 * drawn box and a drawn element can never disagree about where "canonical" is.
 */
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

  // — Pointer handlers (only wired when interactive). All px↔canonical math is
  //   delegated to previewRectToCanonical; nothing here scales coordinates itself. —

  function localPoint(event: PointerEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    if (!interactive || scale <= 0) return;
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

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!drag) return;
    const p = localPoint(event);
    setDrag((d) => (d ? { ...d, cx: p.x, cy: p.y } : d));
  }

  function handlePointerUp(event: PointerEvent<HTMLDivElement>) {
    if (!drag) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const local = normalize(drag.sx, drag.sy, drag.cx, drag.cy);
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
    onSelectRect?.(previewRectToCanonical(viewportRect, { rect, scale }));
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
      {/* Rendered box, centered in the container. Hidden until first measure so the
          stage never flashes at scale 0 / distorted. */}
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

          {/* Committed selection marquee, drawn in canonical units so it scales with
              the stage and sits exactly where the mapped rect says it should. */}
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

      {/* Live drag overlay, drawn in container-local px on top of everything. */}
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

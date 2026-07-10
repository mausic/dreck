import { useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import { CANVAS } from "@/lib/slides";

/** The one canonical↔pixel mapping for a slide preview. */
export interface IUseCanvasScale<T extends HTMLElement> {
  /** Attach to the fit-container whose size the stage is scaled to fill. */
  ref: RefObject<T | null>;
  /** Uniform factor: renderedPx = canonicalUnit * scale. `0` until first measure. */
  scale: number;
  /** The stage's rendered size in px (canonical size * scale). */
  rendered: { width: number; height: number };
  /** False until the container has been measured (use to avoid a distorted flash). */
  ready: boolean;
}

/**
 * Compute — in exactly ONE place — the uniform scale from canonical slide units
 * (1440×810) to rendered pixels, by measuring the fit-container with a ResizeObserver.
 * The stage is rendered at true canonical size and `transform: scale(scale)`, so every
 * element stays in canonical units; only the whole stage scales, aspect-ratio locked.
 *
 * ┌─ SEAM: rectangle-selection (next task) inverts this. ─────────────────────────┐
 * │ Given a pointer event and this container's getBoundingClientRect():            │
 * │   canonicalX = (event.clientX - rect.left) / scale                             │
 * │   canonicalY = (event.clientY - rect.top)  / scale                             │
 * │ i.e. `1 / scale` maps rendered px back to canonical units. Keep this the only  │
 * │ source of the factor so selection and rendering can never disagree. (docs §5)  │
 * └───────────────────────────────────────────────────────────────────────────────┘
 */
export function useCanvasScale<T extends HTMLElement>(): IUseCanvasScale<T> {
  const ref = useRef<T>(null);
  const [scale, setScale] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const measure = () => {
      const { width, height } = el.getBoundingClientRect();
      // Fit within both axes (letterbox-safe). When height is unconstrained the
      // width term wins, which is the common case for an aspect-locked container.
      const next =
        height > 0
          ? Math.min(width / CANVAS.width, height / CANVAS.height)
          : width / CANVAS.width;
      setScale(next > 0 ? next : 0);
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return {
    ref,
    scale,
    rendered: { width: CANVAS.width * scale, height: CANVAS.height * scale },
    ready: scale > 0,
  };
}

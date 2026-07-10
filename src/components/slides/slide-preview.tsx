import type { CSSProperties } from "react";
import type { ISlide, ITokens } from "@/lib/slides";
import { CANVAS } from "@/lib/slides";
import { useCanvasScale } from "@/hooks/use-canvas-scale";
import { SlideElementView } from "@/components/slides/slide-element";
import { cn } from "@/lib/utils";

export interface ISlidePreviewProps {
  slide: ISlide;
  tokens: ITokens;
  className?: string;
}

/**
 * Renders one slide as a canonical 1440×810 stage scaled to fill its container,
 * aspect-ratio locked. The active tokens are written as `--slide-*` CSS custom
 * properties on the stage, so element style presets (which reference those vars)
 * restyle instantly when the tokens change.
 *
 * The scale itself is owned by {@link useCanvasScale} — the single seam that the
 * rectangle-selection feature will invert (pointer px → canonical units).
 */
export function SlidePreview({ slide, tokens, className }: ISlidePreviewProps) {
  const { ref, scale, rendered, ready } = useCanvasScale<HTMLDivElement>();

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

  return (
    <div
      ref={ref}
      className={cn("relative h-full w-full overflow-hidden", className)}
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
            <SlideElementView key={element.id} element={element} />
          ))}
        </div>
      </div>
    </div>
  );
}

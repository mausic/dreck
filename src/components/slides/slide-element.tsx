import type { CSSProperties } from "react";
import type { ISlideElement, TSlotContent } from "@/lib/slides";
import {
  isLabelValue,
  isPanelContent,
  resolveStyle,
  toLines,
} from "@/lib/slides";

/** Label (left) + right-aligned bold value — a single `tableRow`. */
function TableRow({ content }: { content: TSlotContent }) {
  if (!isLabelValue(content)) return null;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        width: "100%",
        height: "100%",
        gap: 16,
      }}
    >
      <span>{content.label}</span>
      <span
        style={{
          fontFamily: "var(--slide-font-display)",
          fontWeight: 700,
          color: "var(--slide-primary)",
          textAlign: "right",
        }}
      >
        {content.value}
      </span>
    </div>
  );
}

/** Primary-colored callout: heading + body. Box styling comes from the element preset. */
function PanelBlock({ content }: { content: TSlotContent }) {
  if (!isPanelContent(content)) return null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <span
        style={{
          fontFamily: "var(--slide-font-display)",
          fontWeight: 800,
          fontSize: 34,
          lineHeight: 1.15,
        }}
      >
        {content.heading}
      </span>
      <span
        style={{
          fontFamily: "var(--slide-font-body)",
          fontSize: 22,
          lineHeight: 1.5,
          opacity: 0.85,
        }}
      >
        {content.body}
      </span>
    </div>
  );
}

/** One or more text lines, stacked. Vertical alignment comes from the element preset. */
function TextContent({ content }: { content: TSlotContent }) {
  const lines = toLines(content);
  if (lines.length === 0) return null;
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {lines.map((line, i) => (
        <span key={i}>{line}</span>
      ))}
    </div>
  );
}

function ElementContent({ element }: { element: ISlideElement }) {
  switch (element.role) {
    case "tableRow":
      return <TableRow content={element.content} />;
    case "panel":
      return <PanelBlock content={element.content} />;
    case "block":
      // Pure colored region (backgrounds, rules) — all visual weight is in the preset.
      return null;
    default:
      // All text roles plus `custom` / any unknown role from extraction: render as
      // plain text. Unknown styleRefs resolve to no preset, so the box inherits the
      // stage's body font + dark text tokens — a sensible default, never a crash.
      return <TextContent content={element.content} />;
  }
}

/**
 * Renders a single slide element as an absolutely-positioned box at its CANONICAL
 * {x,y,w,h}. Because the parent stage is sized 1440×810 and scaled as a whole, these
 * canonical numbers are used directly as pixels here — no per-element scaling.
 *
 * When `selected`, an outline ring marks it as hit by the current selection rectangle.
 * The ring is drawn in canonical px (like everything else on the stage) so it scales
 * with the preview; `outline` sits outside the box and is not clipped by `overflow`.
 */
export function SlideElementView({
  element,
  selected = false,
}: {
  element: ISlideElement;
  selected?: boolean;
}) {
  const style: CSSProperties = {
    position: "absolute",
    left: element.x,
    top: element.y,
    width: element.w,
    height: element.h,
    overflow: "hidden",
    ...resolveStyle(element.styleRef),
    ...(selected
      ? {
          outline: "3px solid var(--slide-selection, #2563eb)",
          outlineOffset: "-1px",
          // Large inset spread = a flat translucent fill, clipped to THIS element
          // (below its content), so multi-select tints each box without stacking.
          boxShadow:
            "inset 0 0 0 9999px color-mix(in srgb, #2563eb 14%, transparent)",
        }
      : null),
  };
  return (
    <div
      data-role={element.role}
      data-element-id={element.id}
      data-selected={selected || undefined}
      style={style}
    >
      <ElementContent element={element} />
    </div>
  );
}

import type { CSSProperties } from "react";
import type {
  ILabelValue,
  IPanelContent,
  ISlideElement,
  TSlotContent,
} from "@/lib/slides";
import { resolveStyle } from "@/lib/slides";

// — Narrowing helpers for the structured content shapes (never trust `Record`) —

function isLabelValue(content: TSlotContent): content is ILabelValue {
  return (
    typeof content === "object" &&
    !Array.isArray(content) &&
    typeof (content as Record<string, unknown>).label === "string" &&
    typeof (content as Record<string, unknown>).value === "string"
  );
}

function isPanelContent(content: TSlotContent): content is IPanelContent {
  return (
    typeof content === "object" &&
    !Array.isArray(content) &&
    typeof (content as Record<string, unknown>).heading === "string" &&
    typeof (content as Record<string, unknown>).body === "string"
  );
}

function toLines(content: TSlotContent): Array<string> {
  if (typeof content === "string") return content.length > 0 ? [content] : [];
  if (Array.isArray(content)) return content;
  return [];
}

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
          color: "var(--slide-navy)",
          textAlign: "right",
        }}
      >
        {content.value}
      </span>
    </div>
  );
}

/** Navy callout: heading + body. Styling of the box comes from the element preset. */
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
 */
export function SlideElementView({ element }: { element: ISlideElement }) {
  const style: CSSProperties = {
    position: "absolute",
    left: element.x,
    top: element.y,
    width: element.w,
    height: element.h,
    overflow: "hidden",
    ...resolveStyle(element.styleRef),
  };
  return (
    <div data-role={element.role} data-element-id={element.id} style={style}>
      <ElementContent element={element} />
    </div>
  );
}

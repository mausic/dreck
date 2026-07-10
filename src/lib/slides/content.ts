/**
 * Type guards + readers for the structured {@link TSlotContent} shapes.
 *
 * Shared by the renderer (`slide-element.tsx`) and the edit transform (`edit.ts`) so
 * there is exactly one place that decides what a piece of slot content *is* — never
 * trust the `Record<string, unknown>` catch-all member of the union blindly.
 */
import type {
  ILabelValue,
  IPanelContent,
  TSlotContent,
} from "@/lib/slides/types";

/** True when `content` is a `{ label, value }` pair (a `tableRow`'s content). */
export function isLabelValue(content: TSlotContent): content is ILabelValue {
  return (
    typeof content === "object" &&
    !Array.isArray(content) &&
    typeof (content as Record<string, unknown>).label === "string" &&
    typeof (content as Record<string, unknown>).value === "string"
  );
}

/** True when `content` is a `{ heading, body }` pair (a `panel`'s content). */
export function isPanelContent(
  content: TSlotContent,
): content is IPanelContent {
  return (
    typeof content === "object" &&
    !Array.isArray(content) &&
    typeof (content as Record<string, unknown>).heading === "string" &&
    typeof (content as Record<string, unknown>).body === "string"
  );
}

/** Normalize text-ish content to an array of lines (empty strings dropped). */
export function toLines(content: TSlotContent): Array<string> {
  if (typeof content === "string") return content.length > 0 ? [content] : [];
  if (Array.isArray(content)) return content;
  return [];
}

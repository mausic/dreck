import type {
  ILabelValue,
  IPanelContent,
  TSlotContent,
} from "@/lib/slides/types";

export function isLabelValue(content: TSlotContent): content is ILabelValue {
  return (
    typeof content === "object" &&
    !Array.isArray(content) &&
    typeof (content as Record<string, unknown>).label === "string" &&
    typeof (content as Record<string, unknown>).value === "string"
  );
}

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

export function toLines(content: TSlotContent): Array<string> {
  if (typeof content === "string") return content.length > 0 ? [content] : [];
  if (Array.isArray(content)) return content;
  return [];
}

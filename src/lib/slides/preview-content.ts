import type { TSlotContent, TSlotRole } from "@/lib/slides/types";

export function previewContentForRole(role: TSlotRole): TSlotContent {
  switch (role) {
    case "block":
      return "";
    case "tableRow":
      return { label: "Label", value: "Value" };
    case "panel":
      return { heading: "Key message", body: "Supporting detail" };
    case "body":
      return ["Key point", "Supporting point"];
    case "title":
      return "Presentation title";
    case "heading":
      return "Slide heading";
    case "eyebrow":
      return "Section label";
    case "footer":
      return "Footer";
    case "logo":
      return "Brand";
    default:
      return "Content";
  }
}

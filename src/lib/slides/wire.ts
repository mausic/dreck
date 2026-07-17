import type { TWireContent } from "@/lib/ai/content-patch";
import type { IWireSlide } from "@/lib/generate/schema";
import type { ISlide, TSlotContent } from "@/lib/slides/types";
import { isLabelValue, isPanelContent } from "@/lib/slides/content";

function toWireContent(content: TSlotContent): TWireContent {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) return content;
  if (isLabelValue(content)) {
    return { label: content.label, value: content.value };
  }
  if (isPanelContent(content)) {
    return { heading: content.heading, body: content.body };
  }
  throw new Error("Slide content has an unsupported persisted shape.");
}

export function toWireSlide(slide: ISlide): IWireSlide {
  return {
    ...slide,
    elements: slide.elements.map((element) => ({
      ...element,
      content: toWireContent(element.content),
    })),
  };
}

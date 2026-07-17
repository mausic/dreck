import { z } from "zod";
import type { ILabelValue, IPanelContent } from "@/lib/slides/types";

export const zContentPatch = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("text"), text: z.string() }),
  z.object({ kind: z.literal("lines"), lines: z.array(z.string()) }),
  z.object({
    kind: z.literal("labelValue"),
    label: z.string(),
    value: z.string(),
  }),
  z.object({ kind: z.literal("panel"), heading: z.string(), body: z.string() }),
]);

export type TContentPatch = z.infer<typeof zContentPatch>;

export type TWireContent = string | Array<string> | ILabelValue | IPanelContent;

/** Collapse a tagged content patch back to a native, serializable content shape. */
export function toSlotContent(content: TContentPatch): TWireContent {
  switch (content.kind) {
    case "text":
      return content.text;
    case "lines":
      return content.lines;
    case "labelValue":
      return { label: content.label, value: content.value };
    case "panel":
      return { heading: content.heading, body: content.body };
  }
}

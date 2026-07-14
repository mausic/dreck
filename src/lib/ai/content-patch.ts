/**
 * The shared tagged content-patch union — the wire shape a model uses to emit slot content.
 *
 * Both the region-edit flow and slide generation need a model to produce {@link TSlotContent},
 * and both hit the same problem: the native `TSlotContent` union mixes primitives, arrays and
 * objects in one `anyOf`, which Gemini's structured-output mode handles unreliably. An
 * all-object discriminated union keyed by `kind` is portable across providers and makes the
 * model state which shape it is producing. {@link toSlotContent} collapses it back to the
 * native shape server-side, so the tag never escapes into the slide model.
 *
 * Lifted out of `edit-schema.ts` (which now re-exports it) so generation can reuse the exact
 * same contract without depending on the edit module.
 */
import { z } from "zod";
import type { ILabelValue, IPanelContent } from "@/lib/slides/types";

/**
 * Model OUTPUT content: an all-object discriminated union keyed by `kind`. Each member
 * maps 1:1 to a native {@link TSlotContent} shape via {@link toSlotContent}.
 */
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

/**
 * The concrete content shapes that cross the wire back to the client — the four native
 * shapes {@link toSlotContent} can produce, deliberately WITHOUT `TSlotContent`'s open
 * `Record<string, unknown>` member (which isn't provably serializable by the server-fn
 * type-check). This is a subset of `TSlotContent`, so it flows straight into the slide model.
 */
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

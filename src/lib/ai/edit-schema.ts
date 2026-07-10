/**
 * The wire contract for the region edit.
 *
 * Two Zod schemas sit either side of the model call:
 *   • {@link EditRegionInputSchema} — what the client sends the server function
 *     (the selected elements + instruction + read-only context + brand tokens).
 *   • {@link EditPatchSchema} — what the model must return. Deliberately constrained:
 *     updated *content* for selected element ids and NOTHING else. It cannot carry
 *     geometry, role, or styleRef, so those fields are structurally unchangeable — the
 *     apply step (`patchFromUpdates` + `applyPatch`) only ever touches `content`.
 *
 * The model output uses a TAGGED discriminated union for content ({@link zContentPatch})
 * rather than the native `TSlotContent` union. Native `TSlotContent` mixes primitives,
 * arrays and objects in one `anyOf`, which Gemini's structured-output mode handles
 * unreliably; an all-object union keyed by `kind` is portable across providers and makes
 * the model state which shape it is producing. {@link toSlotContent} converts it back to
 * the native shape on the server, so the resulting `TEditPatch` stays exactly the shape
 * `applyPatch` already consumes — the tag never escapes this module.
 */
import { z } from "zod";
import type { ILabelValue, IPanelContent, ITokens } from "@/lib/slides/types";

/**
 * The native content shapes, used for the INPUT targets (Zod only parses these — the
 * mixed-type union is fine here since no model is generating against it). The trailing
 * record keeps the union total over `TSlotContent`'s catch-all member so a selected
 * element's content is always assignable when the client builds the request.
 */
export const zSlotContent = z.union([
  z.string(),
  z.array(z.string()),
  z.object({ label: z.string(), value: z.string() }),
  z.object({ heading: z.string(), body: z.string() }),
  z.record(z.string(), z.unknown()),
]);

/** Design tokens forwarded as an on-brand tone cue. Mirrors {@link ITokens} exactly. */
const zTokens = z.object({
  colors: z.object({
    primary: z.string(),
    surface: z.string(),
    accent: z.string(),
    white: z.string(),
    textDark: z.string(),
    textMuted: z.string(),
  }),
  fonts: z.object({
    display: z.string(),
    body: z.string(),
  }),
}) satisfies z.ZodType<ITokens>;

/** Client → server payload for a single region edit. */
export const EditRegionInputSchema = z.object({
  /** The user's edit instruction (the task). */
  instruction: z.string().min(1).max(2000),
  /** The editable targets — the hit-tested selected elements. Only these ids may change. */
  targets: z
    .array(
      z.object({
        id: z.string(),
        role: z.string(),
        content: zSlotContent,
      }),
    )
    .min(1),
  /** Read-only text from the rest of the slide, for coherence. Never edited. */
  context: z.array(z.string()).default([]),
  /** The deck's design tokens, so tone/style stays on-brand. */
  tokens: zTokens.optional(),
});

export type TEditRegionInput = z.input<typeof EditRegionInputSchema>;
export type TEditRegionData = z.output<typeof EditRegionInputSchema>;

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
 * shapes `toSlotContent` can produce, deliberately WITHOUT `TSlotContent`'s open
 * `Record<string, unknown>` member (which isn't provably serializable by the server-fn
 * type-check). This is a subset of `TSlotContent`, so it flows straight into `applyPatch`.
 */
export type TWireContent = string | Array<string> | ILabelValue | IPanelContent;

/** The patch shape returned by `editRegion`: content-only, keyed by selected element id. */
export type TWirePatch = Record<string, { content: TWireContent }>;

/** The model's contract: updated content per selected element id, and nothing else. */
export const EditPatchSchema = z.object({
  updates: z.array(
    z.object({
      /** Must be one of the selected ids; enforced again in `patchFromUpdates`. */
      elementId: z.string(),
      content: zContentPatch,
    }),
  ),
});

export type TEditPatchResult = z.infer<typeof EditPatchSchema>;

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

/**
 * The server function's result. A discriminated result (never a throw) so the client can
 * distinguish "here's the patch" from "the edit soft-failed, leave the deck untouched".
 */
export type TEditRegionResult =
  { ok: true; patch: TWirePatch } | { ok: false; error: string };

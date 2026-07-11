/**
 * The fill step: pour a slide's selected content into an archetype's slots.
 *
 * The model call is a streamed structured generation (`streamObject`) — the machinery streams,
 * so intra-slide progressive rendering is a future add-on; today we await the validated object
 * because the verify step needs the whole slide. What the model returns is content ONLY, keyed
 * by slot id; {@link assembleSlide} copies geometry/role/styleRef straight off the archetype
 * slot (exactly like the hardcoded deck's `buildSlide`). The model therefore cannot move or
 * restyle anything — the same structural guarantee edits have — and the result is a plain flat
 * {@link ISlide} the existing renderer/editor consume unchanged.
 */
import { streamObject } from "ai";
import type { ISection } from "@/lib/extract/section";
import type { IArchetype, ITokens } from "@/lib/slides/types";
import type {
  IWireSlide,
  IWireSlideElement,
  TSlideFill,
} from "@/lib/ai/generate-schema";
import { SlideFillSchema } from "@/lib/ai/generate-schema";
import { toSlotContent } from "@/lib/ai/content-patch";
import { FILL_SYSTEM_PROMPT, buildFillPrompt } from "@/lib/ai/generate-prompt";
import { getGenerateModel } from "@/lib/ai/model";

export interface IFillSlideArgs {
  /** Stable slide id; element ids are derived from it (`${slideId}--${slotId}`). */
  slideId: string;
  intent: string;
  title: string;
  archetype: IArchetype;
  /** The slide's selected sections, verbatim — the only content the fill may draw facts from. */
  sections: Array<ISection>;
  tokens: ITokens;
  /** Set on the retry pass: the ungrounded tokens the previous attempt must fix. */
  failureNote?: string;
}

/**
 * Assemble a flat {@link ISlide} from the model's content-only fill. Every archetype slot
 * becomes an element carrying the slot's geometry/role/styleRef; slots the model didn't fill
 * (or pure-visual ones) render as empty positioned boxes. Mirrors the demo deck's `buildSlide`.
 */
export function assembleSlide(
  slideId: string,
  archetype: IArchetype,
  fill: TSlideFill,
): IWireSlide {
  const bySlot = new Map(
    fill.slots.map((s) => [s.slotId, toSlotContent(s.content)]),
  );
  const elements: Array<IWireSlideElement> = archetype.slots.map((slot) => ({
    id: `${slideId}--${slot.id}`,
    slotId: slot.id,
    role: slot.role,
    x: slot.x,
    y: slot.y,
    w: slot.w,
    h: slot.h,
    content: bySlot.get(slot.id) ?? "",
    styleRef: slot.styleRef,
  }));
  return { id: slideId, archetypeId: archetype.id, elements };
}

/** Run the streamed fill for one slide and assemble the flat slide model. */
export async function fillSlide(args: IFillSlideArgs): Promise<IWireSlide> {
  const result = streamObject({
    model: getGenerateModel(),
    schema: SlideFillSchema,
    system: FILL_SYSTEM_PROMPT,
    prompt: buildFillPrompt({
      intent: args.intent,
      title: args.title,
      archetype: args.archetype,
      sections: args.sections,
      tokens: args.tokens,
      failureNote: args.failureNote,
    }),
    // No SDK-level retry on this interactive hot path: a rate-limit (429) carries a long
    // provider Retry-After (tens of seconds), so an automatic retry would make a throttled
    // request appear to hang. Fail fast instead; the pipeline's own grounding retry re-runs
    // the whole slide once when needed.
    maxRetries: 0,
  });

  // streamObject is LAZY: its `object` promise is resolved from a stream flush that only runs
  // once the output stream is actually pulled — nothing pumps it internally. So drain
  // `partialObjectStream` to drive generation to completion (this is also where intra-slide
  // progressive rendering would forward partials), THEN take the final validated object.
  // Awaiting `object` without consuming a stream would hang forever.
  for await (const partial of result.partialObjectStream) {
    void partial;
  }
  const fill = await result.object;
  return assembleSlide(args.slideId, args.archetype, fill);
}

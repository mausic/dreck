import { streamObject } from "ai";
import type { ISection } from "@/lib/extract/section";
import type { IArchetype, ITokens } from "@/lib/slides/types";
import type {
  IWireSlide,
  IWireSlideElement,
  TSlideFill,
} from "@/lib/generate/schema";
import { SlideFillSchema } from "@/lib/generate/schema";
import { toSlotContent } from "@/lib/ai/content-patch";
import {
  FILL_SYSTEM_PROMPT,
  buildFillPrompt,
  expectedKind,
  fillableSlots,
} from "@/lib/generate/prompt";
import { MODEL_TIMEOUT_MS, getGenerateModel } from "@/lib/ai/model";
import { withModelRetry } from "@/lib/ai/retry";

export interface IFillSlideArgs {
  slideId: string;
  intent: string;
  title: string;
  archetype: IArchetype;
  sections: Array<ISection>;
  tokens: ITokens;
  failureNote?: string;
}

export function validateSlideFill(
  archetype: IArchetype,
  fill: TSlideFill,
): void {
  const expected = new Map(
    fillableSlots(archetype).map((slot) => [slot.id, expectedKind(slot.role)]),
  );
  const seen = new Set<string>();

  for (const slot of fill.slots) {
    const kind = expected.get(slot.slotId);
    if (!kind) throw new Error(`Unknown or non-fillable slot: ${slot.slotId}`);
    if (seen.has(slot.slotId))
      throw new Error(`Duplicate slot: ${slot.slotId}`);
    if (slot.content.kind !== kind) {
      throw new Error(`Slot ${slot.slotId} requires ${kind} content.`);
    }
    seen.add(slot.slotId);
  }

  const missing = Array.from(expected.keys()).filter((id) => !seen.has(id));
  if (missing.length > 0) {
    throw new Error(`Missing content for slots: ${missing.join(", ")}`);
  }
}

export function assembleSlide(
  slideId: string,
  archetype: IArchetype,
  fill: TSlideFill,
): IWireSlide {
  validateSlideFill(archetype, fill);
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

export async function fillSlide(args: IFillSlideArgs): Promise<IWireSlide> {
  const fill = await withModelRetry(async () => {
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
      maxRetries: 0,
      abortSignal: AbortSignal.timeout(MODEL_TIMEOUT_MS),
    });

    for await (const partial of result.partialObjectStream) {
      void partial;
    }
    return result.object;
  });

  return assembleSlide(args.slideId, args.archetype, fill);
}

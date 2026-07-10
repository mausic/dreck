/**
 * The region-edit apply loop, minus the intelligence.
 *
 * `applyEdit` is the seam the real model swaps into: today it deterministically
 * transforms the selected elements' text so the loop is demoable and testable without
 * a network call; later its body becomes an AI SDK `generateObject` call returning the
 * same `TEditPatch` shape. `applyPatch` — the pure, immutable merge that isolates the
 * change to exactly the hit elements — stays untouched across that swap, and so do the
 * drawing / mapping / hit-test layers.
 */
import type { ISlide, ISlideElement, TSlotContent } from "@/lib/slides/types";
import { isLabelValue, isPanelContent } from "@/lib/slides/content";

/**
 * A patch: for each element id, the fields to overwrite. Deliberately `Partial<
 * ISlideElement>` rather than "new content only" so a future model can also nudge
 * geometry or styleRef through the identical channel — the mock happens to only touch
 * `content`.
 */
export type TEditPatch = Record<string, Partial<ISlideElement>>;

/** Transform one string per the instruction (the mock's only "intelligence"). */
function transformText(text: string, instruction: string): string {
  if (text.length === 0) return text;
  return /upper/i.test(instruction) ? text.toUpperCase() : `${text} (edited)`;
}

/** Apply {@link transformText} across whichever content shape an element holds. */
function transformContent(
  content: TSlotContent,
  instruction: string,
): TSlotContent {
  if (typeof content === "string") return transformText(content, instruction);
  if (Array.isArray(content)) {
    return content.map((line) => transformText(line, instruction));
  }
  if (isLabelValue(content)) {
    return {
      label: transformText(content.label, instruction),
      value: transformText(content.value, instruction),
    };
  }
  if (isPanelContent(content)) {
    return {
      heading: transformText(content.heading, instruction),
      body: transformText(content.body, instruction),
    };
  }
  // Unknown record shape: leave untouched (nothing safe to transform).
  return content;
}

/**
 * ┌─ SEAM: real-AI swap point ─────────────────────────────────────────────────────┐
 * │ Compute the patch to apply for `instruction` over the `selected` elements.       │
 * │ MOCK today — deterministic so the edit loop is provable without a model:         │
 * │   • instruction contains "upper" → UPPERCASE the text                            │
 * │   • otherwise                    → append " (edited)"                            │
 * │ LATER: replace this body with an AI SDK `generateObject({ schema, prompt })`     │
 * │ call that returns a `TEditPatch`. The signature — (selected, instruction) →      │
 * │ TEditPatch — is the contract; keeping it fixed means nothing downstream changes. │
 * └──────────────────────────────────────────────────────────────────────────────────┘
 */
export function applyEdit(
  selected: Array<ISlideElement>,
  instruction: string,
): TEditPatch {
  const patch: TEditPatch = {};
  for (const element of selected) {
    patch[element.id] = {
      content: transformContent(element.content, instruction),
    };
  }
  return patch;
}

/**
 * Merge a patch into a slide, immutably. Elements named in the patch become NEW objects
 * with the patched fields overlaid; every other element is returned BY REFERENCE, so
 * untouched elements are `===`-identical to their originals — this is what makes edit
 * isolation provable (and lets React skip re-rendering them). An empty patch returns
 * the exact same slide object.
 */
export function applyPatch(slide: ISlide, patch: TEditPatch): ISlide {
  if (Object.keys(patch).length === 0) return slide;
  return {
    ...slide,
    elements: slide.elements.map((element) =>
      // `in` (not truthiness) so a legitimately empty patch entry still applies; spread
      // order keeps the original id even if a patch tried to override it.
      element.id in patch
        ? { ...element, ...patch[element.id], id: element.id }
        : element,
    ),
  };
}

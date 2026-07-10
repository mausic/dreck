/**
 * The region-edit apply loop.
 *
 * The intelligence lives behind the `editRegion` server function (`@/lib/ai/edit-region`),
 * which runs the model and returns a content patch. This module keeps the two pure,
 * network-free halves the loop is built on:
 *   • {@link patchFromUpdates} — turns the model's validated `{ elementId, content }`
 *     updates into a patch, enforcing the edit's structural guarantees: content-only
 *     (never geometry/role/styleRef) and selected ids only (never a stray element).
 *   • {@link applyPatch} — the immutable merge that isolates the change to exactly the
 *     hit elements. Untouched by the mock→AI swap, and so are the drawing / mapping /
 *     hit-test layers.
 */
import type { ISlide, ISlideElement, TSlotContent } from "@/lib/slides/types";

/**
 * A patch: for each element id, the fields to overwrite. Typed `Partial<ISlideElement>`
 * so {@link applyPatch} can merge it generically, but the edit path only ever populates
 * `content` (see {@link patchFromUpdates}) — geometry/role/styleRef are never patched.
 */
export type TEditPatch = Record<string, Partial<ISlideElement>>;

/** One model-produced update: new content for a single element id. */
export interface IContentUpdate<TContent extends TSlotContent = TSlotContent> {
  elementId: string;
  content: TContent;
}

/**
 * Build a patch from the model's content updates. This is where the edit's constraints
 * are enforced structurally, independent of any prompt or model:
 *   • an update whose `elementId` isn't in `allowedIds` (the hit-tested selection) is
 *     DROPPED — the model can never reach a non-selected element;
 *   • only `content` is written — geometry, role and styleRef are physically absent from
 *     the patch, so an edit cannot move, restyle, or re-role anything.
 * Pure and network-free, so both guarantees are unit-testable without a model call.
 *
 * Generic in the content type so a caller passing the narrow wire shapes gets a patch
 * whose content type stays narrow — the result crosses the server→client boundary, and
 * a `Record<string, unknown>` in the content union isn't provably serializable.
 */
export function patchFromUpdates<TContent extends TSlotContent>(
  updates: Array<IContentUpdate<TContent>>,
  allowedIds: ReadonlySet<string>,
): Record<string, { content: TContent }> {
  const patch: Record<string, { content: TContent }> = {};
  for (const { elementId, content } of updates) {
    if (!allowedIds.has(elementId)) continue;
    patch[elementId] = { content };
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

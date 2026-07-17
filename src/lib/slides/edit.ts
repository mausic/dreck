import type { ISlide, ISlideElement, TSlotContent } from "@/lib/slides/types";

export type TEditPatch = Record<string, Partial<ISlideElement>>;

export interface IContentUpdate<TContent extends TSlotContent = TSlotContent> {
  elementId: string;
  content: TContent;
}

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

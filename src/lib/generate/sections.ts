import type { ISection } from "@/lib/extract/section";
import type { TSlidePlan } from "#/lib/generate/schema";

export interface IDocOverviewItem {
  id: string;
  title: string;
  kind: string;
  snippet: string;
}
export type TDocOverview = Array<IDocOverviewItem>;

export function flattenSections(sections: Array<ISection>): Array<ISection> {
  const out: Array<ISection> = [];
  const walk = (nodes: Array<ISection>): void => {
    for (const node of nodes) {
      out.push(node);
      if (node.children?.length) walk(node.children);
    }
  };
  walk(sections);
  return out;
}

function snippet(content: string, max: number): string {
  const flat = content.replace(/\s+/g, " ").trim();
  return flat.length > max ? `${flat.slice(0, max).trimEnd()}…` : flat;
}

export function summarizeSections(
  sections: Array<ISection>,
  snippetLen = 160,
): TDocOverview {
  return flattenSections(sections).map((s) => ({
    id: s.id,
    title: s.title,
    kind: s.kind,
    snippet: snippet(s.content, snippetLen),
  }));
}

export function selectSections(
  sections: Array<ISection>,
  ids: Array<string>,
): Array<ISection> {
  const byId = new Map(flattenSections(sections).map((s) => [s.id, s]));
  const seen = new Set<string>();
  const out: Array<ISection> = [];
  for (const id of ids) {
    if (seen.has(id)) continue;
    const found = byId.get(id);
    if (found) {
      seen.add(id);
      out.push(found);
    }
  }
  return out;
}

export function isPlanGroundedToSections(
  plan: TSlidePlan,
  sections: Array<ISection>,
): boolean {
  const available = new Set(
    flattenSections(sections).map((section) => section.id),
  );
  return plan.slides.every((slide, index) => {
    const unique = new Set(slide.sectionIds);
    if (unique.size !== slide.sectionIds.length) return false;
    if (slide.sectionIds.some((id) => !available.has(id))) return false;
    return index === 0 || slide.sectionIds.length > 0;
  });
}

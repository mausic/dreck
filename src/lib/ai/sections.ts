/**
 * Section-tree helpers shared by the planner and the fill step.
 *
 * No RAG here by design: the whole section tree fits in context, so the planner gets a
 * COMPACT overview (title/kind + a short snippet per node) to choose slides from, and the
 * fill step gets the SELECTED sections' verbatim content in full. Retrieval is a documented
 * future scaling seam, not built here.
 */
import type { ISection } from "@/lib/extract/section";

/** One node of the planner's compact overview — enough to decide slides, cheap in tokens. */
export interface IDocOverviewItem {
  id: string;
  title: string;
  kind: string;
  /** A short single-lined snippet of the section body, for disambiguation. */
  snippet: string;
}
export type TDocOverview = Array<IDocOverviewItem>;

/** Depth-first flatten of the section forest into a single ordered list (all nodes). */
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

/** Collapse whitespace/newlines and clip to `max` chars so a snippet stays one compact line. */
function snippet(content: string, max: number): string {
  const flat = content.replace(/\s+/g, " ").trim();
  return flat.length > max ? `${flat.slice(0, max).trimEnd()}…` : flat;
}

/**
 * Build the planner's compact overview: every section as `{ id, title, kind, snippet }`.
 * Full bodies are withheld here — they only reach the model at fill time, for the sections
 * a slide actually selects.
 */
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

/**
 * Resolve a plan item's `sectionIds` to their section nodes, in the order requested and
 * de-duplicated. Unknown ids are skipped. Returns `[]` when nothing matches — the caller
 * decides how to fall back.
 */
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

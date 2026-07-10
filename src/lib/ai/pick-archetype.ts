/**
 * Archetype selection — the first step of the per-slide code loop.
 *
 * Written against WHATEVER archetype set is passed in (the available `Record<id, IArchetype>`),
 * never a specific id: today that's the two hardcoded archetypes; when design extraction lands
 * it swaps in behind the same interface and this keeps working. The planner's suggestion wins
 * when it names an available archetype; otherwise a light heuristic on the slide's content
 * shape decides (tabular/figures → a table archetype; a cover-ish intent → a title archetype).
 */
import type { ISection } from "@/lib/extract/section";
import type { IArchetype, TArchetypeId } from "@/lib/slides/types";
import type { TSlidePlanItem } from "@/lib/ai/generate-schema";

/** A markdown table row (`| … | … |`) or a `label: value` list line signals tabular content. */
const TABULAR_RE = /(^|\n)\s*\|.*\|/;
const LABEL_VALUE_RE = /(^|\n)\s*[-*]\s+.+:\s*\S+/;
/** Cover/section-opener language in the slide's intent or title. */
const TITLEISH_RE = /\b(title|cover|overview|introduction|agenda|welcome)\b/i;

/** Pick the id of a defined archetype whose id contains `needle`, or `undefined`. */
function findId(ids: Array<string>, needle: string): TArchetypeId | undefined {
  return ids.find((id) => id.toLowerCase().includes(needle));
}

/**
 * Choose the best-fit archetype for a planned slide from the available set.
 *
 * Order: (1) the planner's suggestion if it's an available id; (2) tabular content → a
 * "table"/"sidebar" archetype; (3) a cover-ish intent → a "title" archetype; (4) otherwise
 * the first non-title archetype, else the first available. Never returns an unknown id.
 */
export function pickArchetype(
  item: TSlidePlanItem,
  sections: Array<ISection>,
  available: Record<string, IArchetype>,
): TArchetypeId {
  const ids = Object.keys(available);
  if (ids.length === 0) {
    throw new Error("No archetypes available to pick from.");
  }

  if (item.archetypeId && ids.includes(item.archetypeId)) {
    return item.archetypeId;
  }

  const body = sections.map((s) => s.content).join("\n");
  const looksTabular = TABULAR_RE.test(body) || LABEL_VALUE_RE.test(body);
  const looksTitleish = TITLEISH_RE.test(`${item.intent} ${item.title}`);

  if (looksTabular) {
    const tabular = findId(ids, "table") ?? findId(ids, "sidebar");
    if (tabular) return tabular;
  }
  if (looksTitleish) {
    const title = findId(ids, "title");
    if (title) return title;
  }

  return ids.find((id) => !id.toLowerCase().includes("title")) ?? ids[0];
}

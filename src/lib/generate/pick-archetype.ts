import type { ISection } from "@/lib/extract/section";
import type { TSlidePlanItem } from "@/lib/generate/schema";
import type {
  IExtractedArchetype,
  TArchetypeCategory,
} from "@/lib/slides/types";
import type { TArchetypeFamily } from "@/lib/slides/archetypes";
import { ARCHETYPE_FAMILIES } from "@/lib/slides/archetypes";

export interface IArchetypeInput {
  item: TSlidePlanItem;
  sections: Array<ISection>;
  index: number;
}

export interface IContentShape {
  /** Parallel items — bullet lines + table data rows. */
  itemCount: number;
  /** Items that read as label→value (`Foo: bar` or a two-cell table row). */
  labelValueCount: number;
  /** Headline figures — numbers carrying a unit, %, or currency. */
  metricCount: number;
  /** Non-item, non-heading prose lines. */
  proseLines: number;
  /** Whether the parallel items are homogeneous (similar length/structure). */
  homogeneous: boolean;
  /** labelValueCount / (items + prose) — how tabular the content is. */
  structuredRatio: number;
  isOpening: boolean;
  isTransition: boolean;
  isDominantMetric: boolean;
  isStrongStatement: boolean;
}

const TABLE_ROW_RE = /^\s*\|.*\|\s*$/;
const TABLE_SEP_RE = /^\s*\|[\s:|-]+\|\s*$/;
const BULLET_RE = /^\s*(?:[-*+]|\d+[.)])\s+/;
const HEADING_RE = /^\s*#{1,6}\s+/;
/**
 * A number carrying a unit / % / currency — a "headline metric" rather than an incidental digit.
 * The trailing `(?![A-Za-z])` guards against matching a unit glued to a longer word (e.g. the `g`
 * in "generic") while still accepting `%` and units followed by whitespace/punctuation.
 */
const METRIC_RE =
  /(?:\$|£|€)\s?\d[\d,]*(?:\.\d+)?|\d[\d,]*(?:\.\d+)?\s?(?:%|mg|mcg|µg|kg|ml|g|hours?|hrs?|minutes?|mins?|seconds?|secs?|days?|weeks?|months?|years?|units?|bn|billion|million|percent|°c|°f|mmhg)(?![A-Za-z])/gi;

const OPENING_RE = /\b(title|cover|welcome|agenda)\b/i;
const TRANSITION_RE = /\b(section|part|chapter|transition|roadmap|divider)\b/i;
const STRONG_RE =
  /\b(quote|takeaway|key message|principle|mission|vision|conclusion|warning|caution|important|remember)\b/i;

function countMatches(re: RegExp, text: string): number {
  return text.match(re)?.length ?? 0;
}

function isLabelValueLine(line: string): boolean {
  if (TABLE_ROW_RE.test(line)) {
    const cells = line
      .split("|")
      .map((cell) => cell.trim())
      .filter((cell) => cell.length > 0);
    return cells.length === 2;
  }
  const cleaned = line.replace(BULLET_RE, "").trim();
  return /^[^:]{1,40}:\s+\S/.test(cleaned);
}

function isHomogeneous(items: Array<string>): boolean {
  if (items.length < 2) return false;
  const lengths = items.map((item) => item.trim().length);
  const avg = lengths.reduce((sum, n) => sum + n, 0) / lengths.length;
  if (avg === 0) return false;
  const maxDeviation = Math.max(...lengths.map((n) => Math.abs(n - avg)));
  return maxDeviation <= avg * 0.9;
}

export function analyzeContentShape(input: IArchetypeInput): IContentShape {
  const { item, sections, index } = input;
  const body = sections.map((section) => section.content).join("\n");
  const intentTitle = `${item.intent} ${item.title}`;

  const lines = body
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  // Gather "items": bullet lines, table data rows, AND inline enumerations (a prose line of 3+
  // short semicolon-separated clauses reads as a list too — extracted content isn't always
  // bulleted, and the fill step reformats it into slots regardless).
  const itemStrings: Array<string> = [];
  let proseLines = 0;
  for (const line of lines) {
    if (HEADING_RE.test(line)) continue;
    if (TABLE_ROW_RE.test(line)) {
      if (!TABLE_SEP_RE.test(line)) itemStrings.push(line);
      continue;
    }
    if (BULLET_RE.test(line)) {
      itemStrings.push(line.replace(BULLET_RE, "").trim());
      continue;
    }
    proseLines++;
    const clauses = line
      .split(";")
      .map((clause) => clause.trim())
      .filter((clause) => clause.length > 0);
    if (clauses.length >= 3 && clauses.every((clause) => clause.length <= 80)) {
      for (const clause of clauses) itemStrings.push(clause);
    }
  }
  const itemCount = itemStrings.length;
  const labelValueCount = itemStrings.filter(isLabelValueLine).length;

  const metricCount = countMatches(METRIC_RE, body);
  const words = body.split(/\s+/).filter((w) => w.length > 0).length;
  const structuredRatio = labelValueCount / Math.max(1, itemCount + proseLines);

  const strongKeyword = STRONG_RE.test(intentTitle);
  const transitionKeyword = TRANSITION_RE.test(intentTitle);

  const isOpening =
    index === 0 ||
    sections.length === 0 ||
    (OPENING_RE.test(intentTitle) && itemCount === 0 && proseLines <= 2);
  // A transition is a near-empty section break — a keyword ("Section 2") or a bare fragment. A
  // short but complete statement (a warning/takeaway) is a callout, not a transition.
  const isTransition =
    !isOpening &&
    !strongKeyword &&
    ((transitionKeyword && itemCount === 0 && proseLines <= 3) ||
      (words <= 4 && itemCount === 0 && sections.length > 0));
  // A stat slide is figures-AS-content: headline numbers with no bulleted list around them.
  // Requiring itemCount === 0 keeps genuine parallel lists (with an incidental number) on cards.
  const isDominantMetric =
    !isOpening &&
    metricCount >= 1 &&
    metricCount <= 6 &&
    itemCount === 0 &&
    proseLines <= 5 &&
    words <= 70;
  const isStrongStatement =
    !isOpening &&
    !isTransition &&
    (strongKeyword ||
      (words <= 28 &&
        itemCount === 0 &&
        metricCount === 0 &&
        proseLines >= 1 &&
        proseLines <= 3));

  return {
    itemCount,
    labelValueCount,
    metricCount,
    proseLines,
    homogeneous: isHomogeneous(itemStrings),
    structuredRatio,
    isOpening,
    isTransition,
    isDominantMetric,
    isStrongStatement,
  };
}

function scoreFamilies(shape: IContentShape): Record<TArchetypeFamily, number> {
  const scores: Record<TArchetypeFamily, number> = {
    title: 0,
    "section-divider": 0,
    callout: 0,
    "two-column": 0,
    "table-sidebar": 0,
    "card-grid": 0,
    stat: 0,
  };

  if (shape.isOpening) scores.title = 1;
  if (shape.isTransition) scores["section-divider"] = 0.95;
  if (shape.isStrongStatement) scores.callout = 0.8;

  if (shape.isDominantMetric) scores.stat = 0.85;
  else if (
    shape.metricCount >= 1 &&
    shape.itemCount >= 1 &&
    shape.itemCount <= 3
  )
    scores.stat = 0.5;

  if (shape.structuredRatio >= 0.5 && shape.itemCount >= 4)
    scores["table-sidebar"] = 0.85;
  else if (shape.labelValueCount >= 4) scores["table-sidebar"] = 0.7;

  if (shape.itemCount >= 2 && shape.itemCount <= 4 && shape.homogeneous)
    scores["card-grid"] = 0.8;
  else if (shape.itemCount >= 2 && shape.itemCount <= 4)
    scores["card-grid"] = 0.55;

  scores["two-column"] =
    shape.itemCount >= 2 && shape.proseLines >= 2 ? 0.7 : 0.4;

  return scores;
}

function familyOf(id: string): TArchetypeFamily | undefined {
  if (id.startsWith("card-grid")) return "card-grid";
  if (id.startsWith("stat")) return "stat";
  return (ARCHETYPE_FAMILIES as ReadonlyArray<string>).includes(id)
    ? (id as TArchetypeFamily)
    : undefined;
}

/**
 * Per-prior-use score fade so the same layout isn't emitted deck-wide. At 0.3 a family drops below
 * the `two-column` floor after ~2 uses, so a third repeat diversifies unless no alternative fits —
 * matching the planner's "no more than two of the same" rule while never forcing a bad fit.
 */
const DIVERSITY_PENALTY = 0.3;
/** Families exempt from the diversity fade — an opening/transition is what it is. */
const DIVERSITY_EXEMPT = new Set<TArchetypeFamily>([
  "title",
  "section-divider",
]);

function feasibleFamilies(shape: IContentShape): Set<TArchetypeFamily> {
  if (shape.isOpening) return new Set<TArchetypeFamily>(["title"]);
  const set = new Set<TArchetypeFamily>(["two-column"]);
  if (shape.isTransition) set.add("section-divider");
  if (shape.itemCount >= 2) set.add("card-grid");
  if (shape.metricCount >= 1) set.add("stat");
  if (shape.itemCount >= 3 || shape.labelValueCount >= 2)
    set.add("table-sidebar");
  if (shape.itemCount <= 4) set.add("callout");
  return set;
}

function scoreSlide(
  shape: IContentShape,
  suggestedId: string | undefined,
  used: Partial<Record<TArchetypeFamily, number>>,
): Record<TArchetypeFamily, number> {
  const feasible = feasibleFamilies(shape);
  const scores = scoreFamilies(shape);
  const suggested = suggestedId ? familyOf(suggestedId) : undefined;

  for (const family of ARCHETYPE_FAMILIES) {
    if (!feasible.has(family)) {
      scores[family] = 0; // never pick a structurally impossible layout
      continue;
    }
    // Honor a feasible planner suggestion: give it the top score so it leads.
    if (family === suggested) scores[family] = 1;
    // Diversity: fade a family the more it's already been used this deck.
    if (!DIVERSITY_EXEMPT.has(family)) {
      scores[family] = Math.max(
        0,
        scores[family] - DIVERSITY_PENALTY * (used[family] ?? 0),
      );
    }
  }
  return scores;
}

function argmaxFamily(
  scores: Record<TArchetypeFamily, number>,
): TArchetypeFamily {
  let best: TArchetypeFamily = "two-column";
  for (const family of ARCHETYPE_FAMILIES) {
    if (scores[family] > scores[best]) best = family;
  }
  return best;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

function resolveVariant(
  family: TArchetypeFamily,
  shape: IContentShape,
): string {
  if (family === "card-grid")
    return `card-grid-${clamp(shape.itemCount, 2, 4)}`;
  if (family === "stat") return `stat-${clamp(shape.metricCount, 1, 3)}`;
  return family;
}

/** Pick the best-fit archetype id for a single slide (no deck-level diversity). */
export function pickArchetype(input: IArchetypeInput): string {
  const shape = analyzeContentShape(input);
  const scores = scoreSlide(shape, input.item.archetypeId, {});
  return resolveVariant(argmaxFamily(scores), shape);
}

export function planArchetypes(inputs: Array<IArchetypeInput>): Array<string> {
  const used: Partial<Record<TArchetypeFamily, number>> = {};

  return inputs.map((input) => {
    const shape = analyzeContentShape(input);
    const scores = scoreSlide(shape, input.item.archetypeId, used);
    const family = argmaxFamily(scores);
    used[family] = (used[family] ?? 0) + 1;
    return resolveVariant(family, shape);
  });
}
export function planExtractedArchetypes(
  inputs: Array<IArchetypeInput>,
  archetypes: Array<IExtractedArchetype>,
): Array<IExtractedArchetype> {
  const cover = archetypes.find((archetype) => archetype.category === "cover");
  const content = archetypes.filter(
    (archetype) => archetype.category !== "cover",
  );
  if (!cover || content.length === 0) {
    throw new Error(
      "Extracted design has no usable cover or content archetype.",
    );
  }

  const byId = new Map(
    archetypes.map((archetype) => [archetype.id, archetype]),
  );
  return inputs.map((input) => {
    if (input.index === 0) return cover;
    const shape = analyzeContentShape(input);
    const suggested = input.item.archetypeId
      ? byId.get(input.item.archetypeId)
      : undefined;
    if (suggested && isExtractedCategoryFeasible(suggested.category, shape)) {
      return suggested;
    }

    const preferred = preferredExtractedCategory(shape);
    return (
      content.find((archetype) => archetype.category === preferred) ??
      content.find((archetype) =>
        isExtractedCategoryFeasible(archetype.category, shape),
      ) ??
      content[0]
    );
  });
}

function preferredExtractedCategory(shape: IContentShape): TArchetypeCategory {
  if (shape.isTransition) return "section";
  if (shape.isDominantMetric) return "metrics";
  if (shape.structuredRatio >= 0.5 || shape.labelValueCount >= 2)
    return "table";
  if (shape.itemCount >= 2) return "parallel-items";
  if (shape.isStrongStatement) return "statement";
  return "mixed";
}

function isExtractedCategoryFeasible(
  category: TArchetypeCategory,
  shape: IContentShape,
): boolean {
  switch (category) {
    case "cover":
      return false;
    case "section":
      return shape.isTransition;
    case "metrics":
      return shape.metricCount >= 1;
    case "parallel-items":
      return shape.itemCount >= 2;
    case "table":
      return shape.itemCount >= 3 || shape.labelValueCount >= 2;
    case "statement":
      return shape.itemCount <= 4;
    case "mixed":
      return true;
  }
}

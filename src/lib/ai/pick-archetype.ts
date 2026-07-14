/**
 * Content-shape-driven archetype selection — the first step of the per-slide code loop.
 *
 * Instead of always picking the same archetype, this derives a few simple SHAPE features from a
 * slide's selected content (how many parallel items, whether they're label→value, whether a
 * headline metric dominates, how much prose, is-opening/is-transition) and maps them to the
 * best-fit archetype FAMILY. Count families (card-grid, stat) then resolve to a concrete variant
 * from the item/metric count, so a card or figure is never left empty.
 *
 * Control sits with the PLANNER: its per-slide archetype choice is honored whenever the layout is
 * structurally feasible for the content ({@link feasibleFamilies}), and the shape scorer only
 * decides when the planner gives no choice or an impossible one (`stat` with no numbers, etc.).
 * That's deliberate — the planner sees the whole deck and can vary layouts far better than a
 * per-slide shape heuristic, which for uniform content (all prose + tables) collapses to two or
 * three archetypes. A deck-level diversity fade in {@link planArchetypes} is the backstop that
 * keeps the mix varied even when the planner under-varies.
 */
import type { ISection } from "@/lib/extract/section";
import type { TSlidePlanItem } from "@/lib/ai/generate-schema";
import type { TArchetypeFamily } from "@/lib/slides/archetypes";
import { ARCHETYPE_FAMILIES } from "@/lib/slides/archetypes";

/** One slide's inputs to selection: its plan item, its resolved sections, its deck position. */
export interface IArchetypeInput {
  item: TSlidePlanItem;
  sections: Array<ISection>;
  index: number;
}

/** Simple, deterministic features describing the shape of a slide's content. */
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

/** Whether a single item line reads as a label→value pair. */
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

/** Items are homogeneous when none is wildly longer/shorter than the average — a "parallel" set. */
function isHomogeneous(items: Array<string>): boolean {
  if (items.length < 2) return false;
  const lengths = items.map((item) => item.trim().length);
  const avg = lengths.reduce((sum, n) => sum + n, 0) / lengths.length;
  if (avg === 0) return false;
  const maxDeviation = Math.max(...lengths.map((n) => Math.abs(n - avg)));
  return maxDeviation <= avg * 0.9;
}

/** Derive {@link IContentShape} from a slide's plan item + selected sections. Pure and cheap. */
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

/** Score each family 0–1 for how well it fits the shape. `two-column` is the always-present floor. */
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

/** The registered family a suggested id belongs to (count variants collapse to their family). */
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

/**
 * Families whose layout is structurally VIABLE for this content — the set the planner is allowed
 * to pick from. This is the validation boundary: the planner's own choice is honored whenever it
 * lands in here and rejected only when it's impossible (`stat` with no numbers, `card-grid` with
 * <2 items, anything but `title` on the cover). `two-column` is always viable for a content slide,
 * so a fallback always exists.
 */
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

/**
 * Score every family for one slide: base shape-fit, restricted to the feasible set, with a feasible
 * planner suggestion HONORED (given the top score so it leads) and a diversity fade for families
 * already used. This is what shifts control to the planner — its per-slide layout choice wins
 * whenever it is viable, so the planner's instructions actually drive the mix of layouts.
 */
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

/** Argmax over families; ties resolve to the earlier-listed family. Defaults to the floor. */
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

/** Resolve a family to a concrete registered archetype id, picking the count variant from shape. */
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

/**
 * Pick archetype ids for a whole deck. Each slide honors the planner's feasible archetype choice,
 * with a diversity fade ({@link DIVERSITY_PENALTY} per prior use) that only overtakes a repeated
 * layout after several uses — so the planner drives the mix and the deck still can't collapse into
 * one archetype if the planner under-varies.
 */
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

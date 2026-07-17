const WEIGHT_RANKS: Record<string, number> = {
  thin: 100,
  hairline: 100,
  extralight: 200,
  ultralight: 200,
  light: 300,
  book: 400,
  normal: 400,
  regular: 400,
  text: 400,
  medium: 500,
  semibold: 600,
  demibold: 600,
  bold: 700,
  extrabold: 800,
  ultrabold: 800,
  black: 900,
  heavy: 900,
};

const BODY_WEIGHTS = new Set(["book", "normal", "regular", "text"]);

export interface IFontFamily {
  family: string;
  cssFamily: string;
  /** How many font entries referenced this family (a rough prominence signal). */
  count: number;
  /** The distinct style suffixes seen, e.g. `["Regular", "SemiBold"]`. */
  weights: Array<string>;
  /** True when a regular/body weight was seen — a signal this is the body family. */
  hasBodyWeight: boolean;
  /** The heaviest observed weight rank — a signal for the display family. */
  maxWeight: number;
}

export interface IExtractedFonts {
  /** CSS font-family for the display/heading role, or `undefined` if none could be resolved. */
  display?: string;
  /** CSS font-family for the body role, or `undefined` if none could be resolved. */
  body?: string;
  /** Every family found, ranked by prominence — for inspection/debugging. */
  families: Array<IFontFamily>;
}

const FONT_ENTRY_RE = /\/(?:FontName|BaseFont)\s*\/([A-Za-z0-9+._-]+)/g;

function prettifyFamily(raw: string): string {
  return raw
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function maxWeightRank(weight: string): number {
  const lower = weight.toLowerCase();
  let max = 0;
  for (const [keyword, rank] of Object.entries(WEIGHT_RANKS)) {
    if (lower.includes(keyword) && rank > max) max = rank;
  }
  return max;
}

function isBodyWeight(weight: string): boolean {
  const lower = weight.toLowerCase();
  for (const w of BODY_WEIGHTS) if (lower.includes(w)) return true;
  return false;
}

function toCssFamily(family: string): string {
  return `"${family}", "Geist Variable", system-ui, sans-serif`;
}

export function extractFonts(pdfBytes: Uint8Array): IExtractedFonts {
  const text = new TextDecoder("latin1").decode(pdfBytes);

  // Tally families across all font entries.
  const byFamily = new Map<
    string,
    { count: number; weights: Set<string>; hasBody: boolean; maxWeight: number }
  >();

  for (const match of text.matchAll(FONT_ENTRY_RE)) {
    const raw = match[1].replace(/^[A-Z]{6}\+/, ""); // strip subset prefix
    const dash = raw.indexOf("-");
    const familyKey = (dash >= 0 ? raw.slice(0, dash) : raw).trim();
    const weight = dash >= 0 ? raw.slice(dash + 1) : "";
    if (familyKey.length === 0) continue;

    const entry = byFamily.get(familyKey) ?? {
      count: 0,
      weights: new Set<string>(),
      hasBody: false,
      maxWeight: 0,
    };
    entry.count += 1;
    if (weight) entry.weights.add(weight);
    if (isBodyWeight(weight) || weight === "") entry.hasBody = true;
    entry.maxWeight = Math.max(entry.maxWeight, maxWeightRank(weight));
    byFamily.set(familyKey, entry);
  }

  const families: Array<IFontFamily> = Array.from(byFamily.entries())
    .map(([key, e]) => ({
      family: prettifyFamily(key),
      cssFamily: toCssFamily(prettifyFamily(key)),
      count: e.count,
      weights: Array.from(e.weights),
      hasBodyWeight: e.hasBody,
      maxWeight: e.maxWeight,
    }))
    .sort((a, b) => b.count - a.count);

  return { ...pickRoles(families), families };
}

function pickRoles(families: Array<IFontFamily>): {
  display?: string;
  body?: string;
} {
  const top = families.slice(0, 2);
  if (top.length === 0) return {};
  if (top.length === 1) {
    return top[0].hasBodyWeight
      ? { body: top[0].cssFamily }
      : { display: top[0].cssFamily };
  }

  const [a, b] = top;
  let bodyFam: IFontFamily;
  let displayFam: IFontFamily;
  if (a.hasBodyWeight !== b.hasBodyWeight) {
    // Exactly one carries a body weight — that's the body family.
    bodyFam = a.hasBodyWeight ? a : b;
    displayFam = a.hasBodyWeight ? b : a;
  } else {
    // Both or neither: the heavier max weight is display.
    displayFam = a.maxWeight >= b.maxWeight ? a : b;
    bodyFam = displayFam === a ? b : a;
  }
  return { display: displayFam.cssFamily, body: bodyFam.cssFamily };
}

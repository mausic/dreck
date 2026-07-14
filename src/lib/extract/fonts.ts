/**
 * Deterministic font-family extraction from a PDF's font info — the deterministic half of design
 * extraction (fonts are never guessed by a model).
 *
 * PDFs name every embedded font in a `/FontName` (or `/BaseFont`) entry, e.g.
 * `/FontName /AAAAAA+IBMPlexSans-SemiBold`. Those entries are plain text in the byte stream (they
 * live in the font descriptor, not a compressed content stream), so a regex over the bytes finds
 * them without a PDF parser or a rasterizer — both impractical on Workers. We strip the 6-letter
 * subset prefix (`AAAAAA+`) and the PostScript style suffix (`-SemiBold`), collapse to families,
 * rank by how often each is referenced, and assign the two dominant families to display/body by
 * weight: the family carrying a regular/body weight is body; the heavier, headline-weight family
 * is display.
 */

/** Weight keyword → numeric rank, for finding a family's heaviest observed weight. */
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

/** Weights that indicate a family is used for body copy (not just headings). */
const BODY_WEIGHTS = new Set(["book", "normal", "regular", "text"]);

/** One font family found in the PDF, with how it is used. */
export interface IFontFamily {
  /** Prettified family name, e.g. `"IBM Plex Sans"`. */
  family: string;
  /** Ready-to-use CSS `font-family` value with a system fallback stack. */
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

/** Deterministic font extraction result: the two role families (when found) + all candidates. */
export interface IExtractedFonts {
  /** CSS font-family for the display/heading role, or `undefined` if none could be resolved. */
  display?: string;
  /** CSS font-family for the body role, or `undefined` if none could be resolved. */
  body?: string;
  /** Every family found, ranked by prominence — for inspection/debugging. */
  families: Array<IFontFamily>;
}

const FONT_ENTRY_RE = /\/(?:FontName|BaseFont)\s*\/([A-Za-z0-9+._-]+)/g;

/** Insert spaces at word boundaries: `IBMPlexSans` → `IBM Plex Sans`, `LibreFranklin` → `Libre Franklin`. */
function prettifyFamily(raw: string): string {
  return raw
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** The heaviest weight rank named anywhere in a style suffix (`"Thin_ExtraBold"` → 800). */
function maxWeightRank(weight: string): number {
  const lower = weight.toLowerCase();
  let max = 0;
  for (const [keyword, rank] of Object.entries(WEIGHT_RANKS)) {
    if (lower.includes(keyword) && rank > max) max = rank;
  }
  return max;
}

/** True when a style suffix names a body weight (`Regular`/`Book`/`Normal`/`Text`). */
function isBodyWeight(weight: string): boolean {
  const lower = weight.toLowerCase();
  for (const w of BODY_WEIGHTS) if (lower.includes(w)) return true;
  return false;
}

/** Assemble a CSS font-family value with the same fallback stack the placeholder tokens use. */
function toCssFamily(family: string): string {
  return `"${family}", "Geist Variable", system-ui, sans-serif`;
}

/**
 * Extract font families from PDF bytes and assign display/body roles. Deterministic and
 * dependency-free (a regex over the latin1-decoded bytes). Roles are `undefined` when they can't be
 * resolved (e.g. a scanned/imageless PDF) — the caller fills those from the fallback tokens.
 */
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

/** Assign display/body from the two most-referenced families (see module note for the heuristic). */
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

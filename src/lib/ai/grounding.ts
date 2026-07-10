/**
 * Grounding verification — deterministic, no model, no embeddings.
 *
 * The fill step writes NEW prose (that's the point — content is generated fresh), so prose is
 * not checked. What IS checked are the FACTUAL tokens: numbers, doses, units, weight bands,
 * ratios, and long ids (DINs). Each such token pulled off a generated slide must appear in the
 * stored source markdown. This is the guard against the model emitting its parametric
 * knowledge — a made-up dose that isn't in the PDF gets flagged.
 *
 * Matching is presence-based after a light normalization (unify dashes, drop commas/spaces,
 * treat a bare "to" as a range separator), so `10 – 15 kg` grounds against `10 to 15 kg`.
 */
import type {
  IGroundingIssue,
  IGroundingReport,
} from "@/lib/ai/generate-schema";
import type { ISlide, ISlideElement } from "@/lib/slides/types";
import { isLabelValue, isPanelContent, toLines } from "@/lib/slides/content";

const NUM = String.raw`\d[\d.,]*`;
const UNIT = String.raw`(?:mg|mcg|µg|ug|kg|g|ml|l|%|mmol|iu|units?|hours?|hrs?|h|days?)`;

/**
 * Figure-like tokens, most specific first: a range/ratio (`10–15 kg`, `160/5`), a value+unit
 * (`325 mg`, `5 %`), a bare decimal (`1.5`), or a long integer / DIN (`1000`). Plain small
 * integers (list counts like "3 benefits") are intentionally NOT matched — they're structural,
 * not clinical figures.
 */
const FIGURE_RE = new RegExp(
  [
    `${NUM}\\s*(?:[-–—/]|to)\\s*${NUM}\\s*${UNIT}?`,
    `${NUM}\\s*${UNIT}`,
    String.raw`\d+\.\d+`,
    String.raw`\d{3,}`,
  ].join("|"),
  "gi",
);

/** Normalize a figure (or a source blob) for presence comparison. */
function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[–—]/g, "-") // unify en/em dashes to hyphen
    .replace(/µ/g, "u") // micro sign → u (mcg/ug/µg all compare)
    .replace(/\bto\b/g, "-") // "10 to 15" ⇢ range separator
    .replace(/,/g, "") // 1,000 ⇢ 1000
    .replace(/\s+/g, ""); // spacing is not significant for a figure
}

/** Every figure-like token in a blob, as matched (un-normalized, for readable flags). */
function extractFigures(text: string): Array<string> {
  return Array.from(text.matchAll(FIGURE_RE), (m) => m[0]);
}

/** The human-readable text carried by an element, across the structured content shapes. */
function elementText(element: ISlideElement): string {
  const content = element.content;
  if (isLabelValue(content)) return `${content.label} ${content.value}`;
  if (isPanelContent(content)) return `${content.heading} ${content.body}`;
  return toLines(content).join(" ");
}

/**
 * Verify a generated slide against the source markdown. Returns every ungrounded factual token
 * (deduplicated per element). `ok` is true when nothing is ungrounded. Pure and model-free, so
 * it's unit-testable and cheap enough to run on every fill + retry.
 */
export function verifySlideGrounding(
  slide: ISlide,
  sourceMarkdown: string,
): IGroundingReport {
  const normSource = normalize(sourceMarkdown);
  const issues: Array<IGroundingIssue> = [];

  for (const element of slide.elements) {
    const seen = new Set<string>();
    for (const raw of extractFigures(elementText(element))) {
      const key = normalize(raw);
      if (key.length === 0 || seen.has(key)) continue;
      seen.add(key);
      if (!normSource.includes(key)) {
        issues.push({
          elementId: element.id,
          role: element.role,
          token: raw.trim(),
        });
      }
    }
  }

  return { ok: issues.length === 0, issues };
}

import type { IGroundingIssue, IGroundingReport } from "@/lib/generate/schema";
import type { ISlide, ISlideElement } from "@/lib/slides/types";
import { isLabelValue, isPanelContent, toLines } from "@/lib/slides/content";

const NUM = String.raw`\d[\d.,]*`;
const UNIT = String.raw`(?:mg|mcg|µg|ug|kg|g|ml|l|%|mmol|iu|units?|hours?|hrs?|h|days?)`;

const FIGURE_RE = new RegExp(
  [
    `${NUM}\\s*(?:[-–—/]|to)\\s*${NUM}\\s*${UNIT}?`,
    `${NUM}\\s*${UNIT}`,
    String.raw`\d+\.\d+`,
    String.raw`\d{3,}`,
  ].join("|"),
  "gi",
);

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[–—]/g, "-") // unify en/em dashes to hyphen
    .replace(/µ/g, "u") // micro sign → u (mcg/ug/µg all compare)
    .replace(/\bto\b/g, "-") // "10 to 15" ⇢ range separator
    .replace(/,/g, "") // 1,000 ⇢ 1000
    .replace(/\s+/g, ""); // spacing is not significant for a figure
}

function extractFigures(text: string): Array<string> {
  return Array.from(text.matchAll(FIGURE_RE), (m) => m[0]);
}

function elementText(element: ISlideElement): string {
  const content = element.content;
  if (isLabelValue(content)) return `${content.label} ${content.value}`;
  if (isPanelContent(content)) return `${content.heading} ${content.body}`;
  return toLines(content).join(" ");
}

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

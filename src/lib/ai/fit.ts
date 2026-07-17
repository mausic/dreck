import type { CSSProperties } from "react";
import type {
  ISlide,
  ISlideElement,
  ISlot,
  TSlotContent,
  TSlotRole,
} from "@/lib/slides/types";
import { resolveStyle } from "@/lib/slides/styles";
import { isLabelValue, isPanelContent } from "@/lib/slides/content";
import { getConfig } from "@/lib/config";

const UPPERCASE_EXTRA = 0.06;
const DEFAULT_LINE_HEIGHT = 1.25;
const DEFAULT_FONT_SIZE = 24;

const PANEL_PAD_X = 46;
const PANEL_PAD_Y = 44;
const PANEL_GAP = 18;
const PANEL_HEADING_FS = 34;
const PANEL_HEADING_LH = 1.15;
const PANEL_HEADING_LINES = 2;
const PANEL_BODY_FS = 22;
const PANEL_BODY_LH = 1.5;
export const MIN_PANEL_WIDTH = 220;
export const MIN_PANEL_HEIGHT = Math.ceil(
  2 * PANEL_PAD_Y +
    PANEL_HEADING_LINES * PANEL_HEADING_FS * PANEL_HEADING_LH +
    PANEL_GAP +
    PANEL_BODY_FS * PANEL_BODY_LH,
);

export interface ICapacity {
  charsPerLine: number;
  maxLines: number;
  maxChars: number;
}

function numeric(value: unknown, fallback: number): number {
  return typeof value === "number" ? value : fallback;
}

/** Letter-spacing (`"0.32em"` / `"1px"` / number) as pixels for the given font size. */
function letterSpacingPx(
  value: CSSProperties["letterSpacing"],
  fontSize: number,
): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const match = value.match(/^(-?[\d.]+)(em|px)?$/);
    if (match) {
      const n = Number.parseFloat(match[1]);
      return match[2] === "px" ? n : n * fontSize;
    }
  }
  return 0;
}

function glyphWidth(fontSize: number, style: CSSProperties): number {
  const generationConfig = getConfig().generation;
  const ratio = generationConfig.GENERATE_FIT_CHAR_RATIO;
  const upper = style.textTransform === "uppercase" ? UPPERCASE_EXTRA : 0;
  return (
    fontSize * (ratio + upper) + letterSpacingPx(style.letterSpacing, fontSize)
  );
}

function charsPerLine(
  widthPx: number,
  fontSize: number,
  style: CSSProperties,
): number {
  return Math.max(1, Math.floor(widthPx / glyphWidth(fontSize, style)));
}

function linesForHeight(
  heightPx: number,
  fontSize: number,
  lineHeight: number,
): number {
  return Math.max(0, Math.floor(heightPx / (fontSize * lineHeight)));
}

export function textCapacity(
  role: TSlotRole,
  styleRef: string,
  w: number,
  h: number,
): ICapacity {
  const style = resolveStyle(styleRef);
  const fontSize = numeric(style.fontSize, DEFAULT_FONT_SIZE);
  const lineHeight = numeric(style.lineHeight, DEFAULT_LINE_HEIGHT);
  const cpl = charsPerLine(w, fontSize, style);
  const heightLines = linesForHeight(h, fontSize, lineHeight);
  const maxLines = role === "tableRow" ? Math.min(1, heightLines) : heightLines;
  return { charsPerLine: cpl, maxLines, maxChars: cpl * maxLines };
}

/** Capacity of a panel's heading + body sub-regions (nested content, own sizes). */
function panelCapacity(
  w: number,
  h: number,
): {
  heading: ICapacity;
  body: ICapacity;
} {
  const generationConfig = getConfig().generation;
  const ratio = generationConfig.GENERATE_FIT_CHAR_RATIO;
  const innerW = Math.max(1, w - 2 * PANEL_PAD_X);
  const innerH = Math.max(1, h - 2 * PANEL_PAD_Y);
  const headingCpl = Math.max(
    1,
    Math.floor(innerW / (PANEL_HEADING_FS * ratio)),
  );
  const usedByHeading =
    PANEL_HEADING_LINES * PANEL_HEADING_FS * PANEL_HEADING_LH + PANEL_GAP;
  const bodyH = Math.max(PANEL_BODY_FS, innerH - usedByHeading);
  const bodyCpl = Math.max(1, Math.floor(innerW / (PANEL_BODY_FS * ratio)));
  const bodyLines = Math.max(
    1,
    Math.floor(bodyH / (PANEL_BODY_FS * PANEL_BODY_LH)),
  );
  const usable = w >= MIN_PANEL_WIDTH && h >= MIN_PANEL_HEIGHT;
  return {
    heading: {
      charsPerLine: headingCpl,
      maxLines: usable ? PANEL_HEADING_LINES : 0,
      maxChars: usable ? headingCpl * PANEL_HEADING_LINES : 0,
    },
    body: {
      charsPerLine: bodyCpl,
      maxLines: usable ? bodyLines : 0,
      maxChars: usable ? bodyCpl * bodyLines : 0,
    },
  };
}

function linesForText(text: string, cpl: number): number {
  const chars = text.trim().length;
  return chars === 0 ? 0 : Math.ceil(chars / cpl);
}

function linesUsed(content: TSlotContent, cpl: number): number {
  if (typeof content === "string") return linesForText(content, cpl);
  if (Array.isArray(content))
    return content.reduce((sum, line) => sum + linesForText(line, cpl), 0);
  if (isLabelValue(content))
    return linesForText(`${content.label}   ${content.value}`, cpl);
  return 1;
}

export function slotCharBudget(slot: ISlot): string {
  if (slot.role === "panel") {
    const { heading, body } = panelCapacity(slot.w, slot.h);
    if (heading.maxLines === 0 || body.maxLines === 0)
      return "no text fits this box";
    return `heading ≤${heading.maxChars} chars, body ≤${body.maxChars} chars`;
  }
  const cap = textCapacity(slot.role, slot.styleRef, slot.w, slot.h);
  if (cap.maxLines === 0) return "no text fits this box";
  if (slot.role === "tableRow")
    return `label + value ≤${cap.maxChars} chars total`;
  return cap.maxLines > 1
    ? `≤${cap.maxChars} chars (≈${cap.maxLines} lines)`
    : `≤${cap.maxChars} chars (one line)`;
}

export interface IFitIssue {
  elementId: string;
  slotId: string;
  role: TSlotRole;
  /** Which sub-region overflowed, for panels. */
  part?: "heading" | "body";
  chars: number;
  maxChars: number;
}

export interface IFitReport {
  ok: boolean;
  issues: Array<IFitIssue>;
}

function overflows(usedLines: number, maxLines: number): boolean {
  const generationConfig = getConfig().generation;
  return usedLines > maxLines * generationConfig.GENERATE_FIT_TOLERANCE;
}

function checkElement(element: ISlideElement, issues: Array<IFitIssue>): void {
  if (element.role === "block") return;
  const { content } = element;

  if (element.role === "panel") {
    if (!isPanelContent(content)) return;
    const cap = panelCapacity(element.w, element.h);
    if (
      overflows(
        linesForText(content.heading, cap.heading.charsPerLine),
        cap.heading.maxLines,
      )
    ) {
      issues.push({
        elementId: element.id,
        slotId: element.slotId,
        role: element.role,
        part: "heading",
        chars: content.heading.length,
        maxChars: cap.heading.maxChars,
      });
    }
    if (
      overflows(
        linesForText(content.body, cap.body.charsPerLine),
        cap.body.maxLines,
      )
    ) {
      issues.push({
        elementId: element.id,
        slotId: element.slotId,
        role: element.role,
        part: "body",
        chars: content.body.length,
        maxChars: cap.body.maxChars,
      });
    }
    return;
  }

  const cap = textCapacity(
    element.role,
    element.styleRef,
    element.w,
    element.h,
  );
  if (overflows(linesUsed(content, cap.charsPerLine), cap.maxLines)) {
    const chars =
      typeof content === "string"
        ? content.length
        : Array.isArray(content)
          ? content.join(" ").length
          : isLabelValue(content)
            ? content.label.length + content.value.length
            : 0;
    issues.push({
      elementId: element.id,
      slotId: element.slotId,
      role: element.role,
      chars,
      maxChars: cap.maxChars,
    });
  }
}

export function verifySlideFit(slide: ISlide): IFitReport {
  const issues: Array<IFitIssue> = [];
  for (const element of slide.elements) checkElement(element, issues);
  return { ok: issues.length === 0, issues };
}

export function describeFitIssues(issues: Array<IFitIssue>): string {
  return issues
    .map((issue) => {
      const where = issue.part
        ? `slot '${issue.slotId}' ${issue.part}`
        : `slot '${issue.slotId}'`;
      return `${where} (${issue.chars} chars) must be ≤ ~${issue.maxChars} chars`;
    })
    .join("; ");
}

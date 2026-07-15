import type {
  IExtractedArchetype,
  ISlot,
  TArchetypeCategory,
  TSlotRole,
  TStyleRef,
} from "@/lib/slides/types";
import {
  ARCHETYPE_CATEGORIES,
  BLOCK_STYLE_REFS,
  CANVAS,
  DARK_BLOCK_STYLE_REFS,
  DARK_TEXT_STYLE_REFS,
  SLOT_ROLES,
  STYLE_REF,
  STYLE_REFS,
  SURFACE_BLOCK_STYLE_REFS,
  resolveStyle,
} from "@/lib/slides";
import {
  ExtractedArchetypeSchema,
  ExtractedArchetypesSchema,
} from "@/lib/slides/archetype-schema";
import { MIN_PANEL_HEIGHT, MIN_PANEL_WIDTH, textCapacity } from "@/lib/ai/fit";

type TSurfaceTone = "dark" | "light";
type TEnhancementKind = "geometry" | "style";

export interface IArchetypeEnhancementIssue {
  archetypeId: string;
  slotId: string;
  kind: TEnhancementKind;
  message: string;
}

export interface IArchetypeEnhancementResult {
  archetypes: Array<IExtractedArchetype>;
  issues: Array<IArchetypeEnhancementIssue>;
}

export interface IArchetypeEnhancementOptions {
  /** Disable catalog-level cover/count rules when preparing one detail call in isolation. */
  validateCatalog?: boolean;
}

interface IBounds {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface IRawExtractedSlot extends Omit<ISlot, "role"> {
  role: string;
}

export interface IRawExtractedArchetype extends Omit<
  IExtractedArchetype,
  "category" | "slots"
> {
  category: string;
  slots: Array<IRawExtractedSlot>;
}

const DEFAULT_FONT_SIZE = 24;
const DEFAULT_LINE_HEIGHT = 1.25;
const TEXT_GAP = 8;
const COMPACT_BLOCK_MAX_HEIGHT = 120;
const COMPACT_BLOCK_INSET_Y = 4;
const KNOWN_STYLE_REFS = new Set<string>(STYLE_REFS);

const LIGHT_HEADING_STYLES = [
  STYLE_REF.dividerTitle,
  STYLE_REF.sidebarHeading,
  STYLE_REF.contentHeading,
  STYLE_REF.calloutQuote,
  STYLE_REF.cardTitle,
  STYLE_REF.twoColRightLabel,
] as const;
const LIGHT_BODY_STYLES = [
  STYLE_REF.contentIntro,
  STYLE_REF.twoColRightBody,
  STYLE_REF.calloutAttribution,
  STYLE_REF.cardDesc,
  STYLE_REF.statCaption,
  STYLE_REF.contentFooter,
] as const;
const LIGHT_CUSTOM_STYLES = [
  STYLE_REF.statFigure,
  STYLE_REF.calloutQuote,
  STYLE_REF.cardValue,
  STYLE_REF.cardTitle,
  STYLE_REF.twoColRightBody,
  STYLE_REF.calloutAttribution,
  STYLE_REF.statLabel,
  STYLE_REF.cardDesc,
  STYLE_REF.statCaption,
  STYLE_REF.contentFooter,
] as const;
const DARK_HEADING_STYLES = [
  STYLE_REF.titleTitle,
  STYLE_REF.sidebarPanelFigure,
  STYLE_REF.titleSubtitle,
  STYLE_REF.sidebarPanelLabel,
] as const;
const DARK_BODY_STYLES = [
  STYLE_REF.titleSubtitle,
  STYLE_REF.sidebarPanelCaption,
  STYLE_REF.titleFooter,
] as const;

function requiredLines(role: TSlotRole): number {
  return role === "body" ? 2 : 1;
}

function normalizeId(value: string, fallback: string): string {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const id = normalized || fallback;
  return /^[a-z]/.test(id) ? id : `layout-${id}`;
}

function uniqueId(base: string, used: Set<string>): string {
  let id = base;
  let suffix = 2;
  while (used.has(id)) {
    id = `${base}-${suffix}`;
    suffix++;
  }
  used.add(id);
  return id;
}

function normalizeRole(value: string): TSlotRole {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, "-");
  const aliases: Partial<Record<string, TSlotRole>> = {
    background: "block",
    shape: "block",
    rule: "block",
    "panel-background": "block",
    kicker: "eyebrow",
    "section-label": "eyebrow",
    text: "custom",
    metric: "custom",
    list: "body",
    "table-row": "tableRow",
    tablerow: "tableRow",
  };
  const alias = aliases[normalized];
  if (alias) return alias;
  const exact = SLOT_ROLES.find(
    (role) => role.toLowerCase() === normalized.replaceAll("-", ""),
  );
  return exact ?? "custom";
}

function normalizeCategory(
  value: string,
  identity: string,
): TArchetypeCategory {
  if ((ARCHETYPE_CATEGORIES as ReadonlyArray<string>).includes(value)) {
    return value as TArchetypeCategory;
  }
  const normalized = value.toLowerCase();
  if (/cover|title/.test(normalized)) return "cover";
  if (/section|divider|transition/.test(normalized)) return "section";
  if (/statement|callout|quote|warning/.test(normalized)) return "statement";
  if (/parallel|card|comparison/.test(normalized)) return "parallel-items";
  if (/metric|stat|number/.test(normalized)) return "metrics";
  if (/table|row|dosing/.test(normalized)) return "table";
  const identityCategory = identity.toLowerCase();
  if (/cover|title/.test(identityCategory)) return "cover";
  if (/section|divider|transition/.test(identityCategory)) return "section";
  if (/statement|callout|quote|warning/.test(identityCategory))
    return "statement";
  if (/parallel|card|comparison/.test(identityCategory))
    return "parallel-items";
  if (/metric|stat|number/.test(identityCategory)) return "metrics";
  if (/table|row|dosing/.test(identityCategory)) return "table";
  return "mixed";
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function normalizeGeometry(
  slot: IRawExtractedSlot,
): Pick<ISlot, "x" | "y" | "w" | "h"> {
  const x = clamp(Math.round(slot.x), 0, CANVAS.width - 1);
  const y = clamp(Math.round(slot.y), 0, CANVAS.height - 1);
  const w = clamp(Math.round(Math.abs(slot.w)), 1, CANVAS.width - x);
  const h = clamp(Math.round(Math.abs(slot.h)), 1, CANVAS.height - y);
  return { x, y, w, h };
}

function defaultBlockStyle(
  category: TArchetypeCategory,
  slot: Pick<ISlot, "w" | "h">,
): TStyleRef {
  if (
    category === "cover" &&
    slot.w * slot.h >= CANVAS.width * CANVAS.height * 0.5
  )
    return STYLE_REF.titleBg;
  if (slot.h <= 16) return STYLE_REF.calloutRule;
  return STYLE_REF.cardBg;
}

function orderSlots(slots: Array<ISlot>): Array<ISlot> {
  return slots
    .map((slot, index) => ({ slot, index }))
    .sort((left, right) => {
      const leftBlock = left.slot.role === "block";
      const rightBlock = right.slot.role === "block";
      if (leftBlock !== rightBlock) return leftBlock ? -1 : 1;
      if (leftBlock && rightBlock) {
        const areaDifference =
          right.slot.w * right.slot.h - left.slot.w * left.slot.h;
        if (areaDifference !== 0) return areaDifference;
      }
      return left.index - right.index;
    })
    .map(({ slot }) => slot);
}

function normalizeRawArchetypes(
  archetypes: Array<IRawExtractedArchetype>,
  issues: Array<IArchetypeEnhancementIssue>,
  validateCatalog: boolean,
): Array<IExtractedArchetype> {
  const archetypeIds = new Set<string>();
  const normalized = archetypes.map((archetype, archetypeIndex) => {
    const id = uniqueId(
      normalizeId(archetype.id, `layout-${archetypeIndex + 1}`),
      archetypeIds,
    );
    const category = normalizeCategory(
      archetype.category,
      `${archetype.id} ${archetype.name}`,
    );
    const slotIds = new Set<string>();
    const slots = archetype.slots.map((rawSlot, slotIndex): ISlot => {
      const slotId = uniqueId(
        normalizeId(rawSlot.id, `slot-${slotIndex + 1}`),
        slotIds,
      );
      const role = normalizeRole(rawSlot.role);
      const geometry = normalizeGeometry(rawSlot);
      let styleRef = rawSlot.styleRef;
      if (role === "block" && !BLOCK_STYLE_REFS.has(styleRef)) {
        styleRef = defaultBlockStyle(category, geometry);
      }
      if (
        slotId !== rawSlot.id ||
        role !== rawSlot.role ||
        styleRef !== rawSlot.styleRef ||
        geometry.x !== rawSlot.x ||
        geometry.y !== rawSlot.y ||
        geometry.w !== rawSlot.w ||
        geometry.h !== rawSlot.h
      ) {
        issues.push({
          archetypeId: id,
          slotId,
          kind:
            role === rawSlot.role && styleRef === rawSlot.styleRef
              ? "geometry"
              : "style",
          message: "Normalized model-extracted slot data.",
        });
      }
      return { id: slotId, role, styleRef, ...geometry };
    });
    return {
      id,
      name: archetype.name.trim() || `Layout ${archetypeIndex + 1}`,
      category,
      description:
        archetype.description.trim() || "Extracted presentation layout.",
      slots: orderSlots(slots),
    };
  });

  if (validateCatalog) {
    const coverIndex = normalized.findIndex(
      (archetype) => archetype.category === "cover",
    );
    if (coverIndex === -1) {
      normalized[0].category = "cover";
      for (const slot of normalized[0].slots) {
        if (
          slot.role === "block" &&
          slot.w * slot.h >= CANVAS.width * CANVAS.height * 0.5
        ) {
          slot.styleRef = STYLE_REF.titleBg;
        }
      }
    } else {
      for (const [index, archetype] of normalized.entries()) {
        if (index !== coverIndex && archetype.category === "cover") {
          archetype.category = "mixed";
        }
      }
    }
  }
  return normalized;
}

function requiredChars(role: TSlotRole): number {
  switch (role) {
    case "title":
    case "heading":
      return 12;
    case "body":
      return 20;
    case "subtitle":
      return 16;
    case "tableRow":
      return 14;
    case "block":
      return 0;
    default:
      return 8;
  }
}

function styleFontSize(styleRef: TStyleRef): number {
  const fontSize = resolveStyle(styleRef).fontSize;
  return typeof fontSize === "number" ? fontSize : DEFAULT_FONT_SIZE;
}

function minimumHeight(styleRef: TStyleRef, lines: number): number {
  const style = resolveStyle(styleRef);
  const fontSize =
    typeof style.fontSize === "number" ? style.fontSize : DEFAULT_FONT_SIZE;
  const lineHeight =
    typeof style.lineHeight === "number"
      ? style.lineHeight
      : DEFAULT_LINE_HEIGHT;
  return Math.ceil(fontSize * lineHeight * lines);
}

function slotBounds(slot: ISlot): IBounds {
  return {
    left: slot.x,
    top: slot.y,
    right: slot.x + slot.w,
    bottom: slot.y + slot.h,
  };
}

function containsCenter(container: ISlot, slot: ISlot): boolean {
  const centerX = slot.x + slot.w / 2;
  const centerY = slot.y + slot.h / 2;
  return (
    centerX >= container.x &&
    centerX <= container.x + container.w &&
    centerY >= container.y &&
    centerY <= container.y + container.h
  );
}

function containingBlock(slot: ISlot, slots: Array<ISlot>): ISlot | undefined {
  return slots
    .filter(
      (candidate) =>
        candidate.role === "block" &&
        SURFACE_BLOCK_STYLE_REFS.has(candidate.styleRef) &&
        containsCenter(candidate, slot),
    )
    .sort((left, right) => left.w * left.h - right.w * right.h)[0];
}

function centerInCompactBlock(
  archetypeId: string,
  slot: ISlot,
  slots: Array<ISlot>,
  issues: Array<IArchetypeEnhancementIssue>,
): void {
  if (slot.role === "block" || slot.role === "panel") return;
  const block = containingBlock(slot, slots);
  if (!block || block.h > COMPACT_BLOCK_MAX_HEIGHT) return;
  const containedText = slots.filter(
    (candidate) =>
      candidate.role !== "block" && containingBlock(candidate, slots) === block,
  );
  if (containedText.length !== 1) return;

  const availableHeight = block.h - 2 * COMPACT_BLOCK_INSET_Y;
  if (availableHeight < minimumSlotHeight(slot)) return;
  const y = block.y + COMPACT_BLOCK_INSET_Y;
  if (slot.y === y && slot.h === availableHeight) return;

  slot.y = y;
  slot.h = availableHeight;
  issues.push({
    archetypeId,
    slotId: slot.id,
    kind: "geometry",
    message: `Centered text within compact block '${block.id}'.`,
  });
}

function boundsFor(slot: ISlot, slots: Array<ISlot>): IBounds {
  const block = containingBlock(slot, slots);
  return block
    ? slotBounds(block)
    : { left: 0, top: 0, right: CANVAS.width, bottom: CANVAS.height };
}

function surfaceFor(slot: ISlot, slots: Array<ISlot>): TSurfaceTone {
  const block = containingBlock(slot, slots);
  return block && DARK_BLOCK_STYLE_REFS.has(block.styleRef) ? "dark" : "light";
}

function candidatesFor(
  role: TSlotRole,
  surface: TSurfaceTone,
): Array<TStyleRef> {
  if (role === "panel") return [STYLE_REF.sidebarPanel];
  if (role === "tableRow") {
    return [
      surface === "dark" ? STYLE_REF.sidebarDarkRow : STYLE_REF.sidebarRow,
    ];
  }
  if (surface === "dark") {
    switch (role) {
      case "logo":
        return [STYLE_REF.titleLogo, STYLE_REF.titleFooter];
      case "eyebrow":
        return [
          STYLE_REF.titleEyebrow,
          STYLE_REF.sidebarPanelLabel,
          STYLE_REF.titleFooter,
        ];
      case "title":
      case "heading":
        return [...DARK_HEADING_STYLES];
      default:
        return [...DARK_BODY_STYLES];
    }
  }
  switch (role) {
    case "eyebrow":
      return [
        STYLE_REF.contentEyebrow,
        STYLE_REF.calloutEyebrow,
        STYLE_REF.twoColRightLabel,
        STYLE_REF.contentFooter,
      ];
    case "title":
    case "heading":
      return [...LIGHT_HEADING_STYLES];
    case "logo":
      return [STYLE_REF.cardTitle, STYLE_REF.contentFooter];
    case "body":
    case "subtitle":
    case "footer":
      return [...LIGHT_BODY_STYLES];
    default:
      return [...LIGHT_CUSTOM_STYLES];
  }
}

function styleMatchesSurface(
  role: TSlotRole,
  styleRef: TStyleRef,
  surface: TSurfaceTone,
): boolean {
  if (role === "panel" && styleRef === STYLE_REF.sidebarPanel) return true;
  if (role === "tableRow") {
    return surface === "dark"
      ? styleRef === STYLE_REF.sidebarDarkRow
      : styleRef === STYLE_REF.sidebarRow;
  }
  if (!KNOWN_STYLE_REFS.has(styleRef)) return false;
  return surface === "dark"
    ? DARK_TEXT_STYLE_REFS.has(styleRef)
    : !DARK_TEXT_STYLE_REFS.has(styleRef) && !BLOCK_STYLE_REFS.has(styleRef);
}

function slotFits(slot: ISlot, styleRef: TStyleRef): boolean {
  if (slot.role === "panel")
    return slot.w >= MIN_PANEL_WIDTH && slot.h >= MIN_PANEL_HEIGHT;
  const capacity = textCapacity(slot.role, styleRef, slot.w, slot.h);
  return (
    capacity.maxLines >= requiredLines(slot.role) &&
    capacity.charsPerLine >= requiredChars(slot.role)
  );
}

function uniqueStyles(styles: Array<TStyleRef>): Array<TStyleRef> {
  return [...new Set(styles)];
}

function chooseStyle(
  slot: ISlot,
  surface: TSurfaceTone,
): TStyleRef | undefined {
  const currentSize = styleFontSize(slot.styleRef);
  const candidates = uniqueStyles([
    ...(styleMatchesSurface(slot.role, slot.styleRef, surface)
      ? [slot.styleRef]
      : []),
    ...candidatesFor(slot.role, surface),
  ]);
  return candidates
    .filter((styleRef) => slotFits(slot, styleRef))
    .sort(
      (left, right) =>
        Math.abs(styleFontSize(left) - currentSize) -
        Math.abs(styleFontSize(right) - currentSize),
    )[0];
}

function smallestCandidate(slot: ISlot, surface: TSurfaceTone): TStyleRef {
  return candidatesFor(slot.role, surface).sort(
    (left, right) => styleFontSize(left) - styleFontSize(right),
  )[0];
}

function expandToFit(slot: ISlot, slots: Array<ISlot>): void {
  const bounds = boundsFor(slot, slots);
  if (slot.role === "panel") {
    const width = Math.min(
      Math.max(slot.w, MIN_PANEL_WIDTH),
      bounds.right - bounds.left,
    );
    const height = Math.min(
      Math.max(slot.h, MIN_PANEL_HEIGHT),
      bounds.bottom - bounds.top,
    );
    slot.x = Math.min(Math.max(slot.x, bounds.left), bounds.right - width);
    slot.y = Math.min(Math.max(slot.y, bounds.top), bounds.bottom - height);
    slot.w = width;
    slot.h = height;
    return;
  }
  const minHeight = minimumHeight(slot.styleRef, requiredLines(slot.role));
  const height = Math.min(
    Math.max(slot.h, minHeight),
    bounds.bottom - bounds.top,
  );
  slot.y = Math.min(Math.max(slot.y, bounds.top), bounds.bottom - height);
  slot.h = height;

  const capacity = textCapacity(slot.role, slot.styleRef, slot.w, slot.h);
  const minChars = requiredChars(slot.role);
  if (capacity.charsPerLine < minChars) {
    const targetWidth = Math.ceil(
      slot.w * (minChars / Math.max(1, capacity.charsPerLine)),
    );
    const width = Math.min(targetWidth, bounds.right - bounds.left);
    slot.x = Math.min(Math.max(slot.x, bounds.left), bounds.right - width);
    slot.w = width;
  }
}

function normalizeSlot(
  archetypeId: string,
  slot: ISlot,
  slots: Array<ISlot>,
  issues: Array<IArchetypeEnhancementIssue>,
): void {
  if (slot.role === "block") return;
  const surface = surfaceFor(slot, slots);
  const selected = chooseStyle(slot, surface);
  if (selected) {
    if (selected !== slot.styleRef) {
      issues.push({
        archetypeId,
        slotId: slot.id,
        kind: "style",
        message: `Changed ${slot.styleRef} to ${selected} for a ${surface} surface.`,
      });
      slot.styleRef = selected;
    }
    return;
  }

  const fallback = smallestCandidate(slot, surface);
  if (fallback !== slot.styleRef) {
    issues.push({
      archetypeId,
      slotId: slot.id,
      kind: "style",
      message: `Changed ${slot.styleRef} to ${fallback} before resizing.`,
    });
    slot.styleRef = fallback;
  }
  const before = { w: slot.w, h: slot.h };
  expandToFit(slot, slots);
  if (before.w !== slot.w || before.h !== slot.h) {
    issues.push({
      archetypeId,
      slotId: slot.id,
      kind: "geometry",
      message: `Expanded ${before.w}×${before.h} to ${slot.w}×${slot.h}.`,
    });
  }
  if (!slotFits(slot, slot.styleRef)) {
    throw new Error(
      `Extracted archetype '${archetypeId}' has an unusable slot '${slot.id}'.`,
    );
  }
}

function horizontalOverlapRatio(left: ISlot, right: ISlot): number {
  const width = Math.max(
    0,
    Math.min(left.x + left.w, right.x + right.w) - Math.max(left.x, right.x),
  );
  return width / Math.max(1, Math.min(left.w, right.w));
}

function textSlotsConflict(upper: ISlot, lower: ISlot): boolean {
  return (
    horizontalOverlapRatio(upper, lower) >= 0.35 &&
    lower.y < upper.y + upper.h + TEXT_GAP
  );
}

function compactOverlappingSlots(
  upper: ISlot,
  lower: ISlot,
  slots: Array<ISlot>,
): boolean {
  const upperBounds = boundsFor(upper, slots);
  const lowerBounds = boundsFor(lower, slots);
  const top = Math.max(upperBounds.top, lowerBounds.top);
  const bottom = Math.min(upperBounds.bottom, lowerBounds.bottom);
  const upperHeight = minimumSlotHeight(upper);
  const lowerHeight = minimumSlotHeight(lower);
  const totalHeight = upperHeight + TEXT_GAP + lowerHeight;
  if (bottom - top < totalHeight) return false;

  const currentTop = Math.min(upper.y, lower.y);
  const currentBottom = Math.max(upper.y + upper.h, lower.y + lower.h);
  const centeredStart = (currentTop + currentBottom - totalHeight) / 2;
  const start = Math.round(
    Math.min(Math.max(centeredStart, top), bottom - totalHeight),
  );
  upper.y = start;
  upper.h = upperHeight;
  lower.y = start + upperHeight + TEXT_GAP;
  lower.h = lowerHeight;
  return true;
}

function repairTextOverlaps(
  archetype: IExtractedArchetype,
  issues: Array<IArchetypeEnhancementIssue>,
): void {
  const textSlots = archetype.slots.filter((slot) => slot.role !== "block");
  const maxRepairs = Math.max(1, textSlots.length ** 2 * 2);

  for (let repair = 0; repair < maxRepairs; repair++) {
    textSlots.sort((left, right) => left.y - right.y);
    let changed = false;

    outer: for (let leftIndex = 0; leftIndex < textSlots.length; leftIndex++) {
      for (
        let rightIndex = leftIndex + 1;
        rightIndex < textSlots.length;
        rightIndex++
      ) {
        const upper = textSlots[leftIndex];
        const lower = textSlots[rightIndex];
        if (!textSlotsConflict(upper, lower)) continue;

        const targetY = upper.y + upper.h + TEXT_GAP;
        const shift = targetY - lower.y;
        const bounds = boundsFor(lower, archetype.slots);
        if (shift > 0 && lower.y + shift + lower.h <= bounds.bottom) {
          lower.y += shift;
          issues.push({
            archetypeId: archetype.id,
            slotId: lower.id,
            kind: "geometry",
            message: `Shifted down ${shift}px to remove text overlap.`,
          });
          changed = true;
          break outer;
        }

        const availableHeight = lower.y - upper.y - TEXT_GAP;
        if (availableHeight >= minimumSlotHeight(upper)) {
          upper.h = availableHeight;
          issues.push({
            archetypeId: archetype.id,
            slotId: upper.id,
            kind: "geometry",
            message: `Reduced height to ${availableHeight}px to remove text overlap.`,
          });
          changed = true;
          break outer;
        }

        if (compactOverlappingSlots(upper, lower, archetype.slots)) {
          issues.push({
            archetypeId: archetype.id,
            slotId: lower.id,
            kind: "geometry",
            message: `Compacted '${upper.id}' and '${lower.id}' to remove text overlap.`,
          });
          changed = true;
          break outer;
        }

        throw new Error(
          `Extracted archetype '${archetype.id}' has overlapping text slots '${upper.id}' and '${lower.id}'.`,
        );
      }
    }

    if (!changed) break;
    if (repair === maxRepairs - 1) {
      throw new Error(
        `Extracted archetype '${archetype.id}' could not resolve all text overlaps.`,
      );
    }
  }

  for (const slot of textSlots) {
    if (!slotFits(slot, slot.styleRef)) {
      throw new Error(
        `Extracted archetype '${archetype.id}' has an unusable slot '${slot.id}' after overlap repair.`,
      );
    }
  }
  for (let leftIndex = 0; leftIndex < textSlots.length; leftIndex++) {
    for (
      let rightIndex = leftIndex + 1;
      rightIndex < textSlots.length;
      rightIndex++
    ) {
      if (textSlotsConflict(textSlots[leftIndex], textSlots[rightIndex])) {
        throw new Error(
          `Extracted archetype '${archetype.id}' still contains crowded text slots.`,
        );
      }
    }
  }
}

function minimumSlotHeight(slot: ISlot): number {
  return slot.role === "panel"
    ? MIN_PANEL_HEIGHT
    : minimumHeight(slot.styleRef, requiredLines(slot.role));
}

/** Make model-extracted layouts mechanically safe before they are previewed or persisted. */
export function enhanceExtractedArchetypes(
  archetypes: Array<IRawExtractedArchetype>,
  options: IArchetypeEnhancementOptions = {},
): IArchetypeEnhancementResult {
  const issues: Array<IArchetypeEnhancementIssue> = [];
  const validateCatalog = options.validateCatalog ?? true;
  const enhanced = normalizeRawArchetypes(archetypes, issues, validateCatalog);

  for (const archetype of enhanced) {
    for (const slot of archetype.slots) {
      normalizeSlot(archetype.id, slot, archetype.slots, issues);
      centerInCompactBlock(archetype.id, slot, archetype.slots, issues);
    }
    repairTextOverlaps(archetype, issues);
  }

  return {
    archetypes: validateCatalog
      ? ExtractedArchetypesSchema.parse(enhanced)
      : enhanced.map((archetype) => ExtractedArchetypeSchema.parse(archetype)),
    issues,
  };
}

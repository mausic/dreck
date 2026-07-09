import type {
  IArchetype,
  IDeck,
  ISlide,
  ISlideElement,
  TSlotContent,
} from "@/lib/slides/types";
import { getArchetype } from "@/lib/slides/archetypes";

/**
 * FAKE PLACEHOLDER DATA — obviously not real.
 *
 * A hardcoded deck standing in for the eventual generation output. Content is
 * intentionally marked as placeholder; geometry/roles/styleRefs are inherited from
 * the archetype slots (see `buildSlide`) so slides stay model-driven, never
 * hand-placed pixels. Numbers below are illustrative only — NOT clinical guidance.
 */

/** Fill an archetype's slots with content, deriving each element's geometry/role/
 * styleRef from its slot. Slots with no content entry (e.g. backgrounds, rules)
 * render as empty positioned boxes styled purely by their styleRef. */
function buildSlide(
  id: string,
  archetype: IArchetype,
  contentBySlot: Record<string, TSlotContent>,
): ISlide {
  const elements: Array<ISlideElement> = archetype.slots.map((slot) => ({
    id: `${id}--${slot.id}`,
    slotId: slot.id,
    role: slot.role,
    x: slot.x,
    y: slot.y,
    w: slot.w,
    h: slot.h,
    content: contentBySlot[slot.id] ?? "",
    styleRef: slot.styleRef,
  }));
  return { id, archetypeId: archetype.id, elements };
}

const titleSlide = buildSlide("slide-title", getArchetype("title"), {
  logo: "◇ PLACEHOLDER PHARMA",
  eyebrow: "Placeholder — Product Monograph",
  title: ["Placeholder Drug", "Dosing Overview"],
  subtitle:
    "Sample subtitle copy — swapped for real, PDF-extracted content in a later task.",
  footer: "PLACEHOLDER DECK · illustrative only · not for clinical use · v0",
});

const dosingSlide = buildSlide("slide-dosing", getArchetype("table-sidebar"), {
  eyebrow: "Placeholder — Dosing by Weight",
  heading: ["Weight-based dosing", "(placeholder data)"],
  "row-1": { label: "10 – 15 kg", value: "120 mg" },
  "row-2": { label: "16 – 21 kg", value: "180 mg" },
  "row-3": { label: "22 – 27 kg", value: "240 mg" },
  "row-4": { label: "28 – 32 kg", value: "300 mg" },
  "row-5": { label: "33 kg +", value: "360 mg" },
  footer:
    "Placeholder figures — do not use. Replaced by the extracted dosing table.",
  panel: {
    heading: "Sample callout",
    body: "This navy panel is placeholder copy standing in for an extracted key-message block.",
  },
});

const formsSlide = buildSlide("slide-forms", getArchetype("table-sidebar"), {
  eyebrow: "Placeholder — Presentation Forms",
  heading: ["Available forms", "(sample catalogue)"],
  "row-1": { label: "Tablet", value: "325 mg" },
  "row-2": { label: "Caplet", value: "500 mg" },
  "row-3": { label: "Oral suspension", value: "160 mg / 5 mL" },
  "row-4": { label: "Suppository", value: "80 mg" },
  "row-5": { label: "Effervescent", value: "1000 mg" },
  footer: "Placeholder catalogue — illustrative only.",
  panel: {
    heading: "Reuse demo",
    body: "Same table-sidebar archetype, different placeholder content — proof the renderer is data-driven.",
  },
});

/** The hardcoded demo deck: one title + two table-sidebar slides (archetype reused). */
export const DEMO_DECK: IDeck = {
  id: "demo-deck",
  slides: [titleSlide, dosingSlide, formsSlide],
};

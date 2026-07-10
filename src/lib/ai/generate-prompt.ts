/**
 * Generation prompts — versioned constants in code (the two DB-backed prompts are the
 * extraction prompts, a later task). Two model calls, two prompts:
 *   • PLAN — the user's chat prompt + a compact document overview → a slide plan. The prompt
 *     drives the slide count; the model selects which sections feed each slide.
 *   • FILL — one slide's archetype slots + its selected sections' verbatim content + design
 *     tokens → content per slot. Facts come ONLY from the provided sections; nothing invented.
 *
 * Both keep the model in a planner/filler role: it never decides its own next action. The
 * orchestrator (`generate-deck.ts`) owns the loop.
 */
import type { ISection } from "@/lib/extract/section";
import type { IArchetype, ISlot, ITokens, TSlotRole } from "@/lib/slides/types";
import type { IGroundingIssue } from "@/lib/ai/generate-schema";
import type { TDocOverview } from "@/lib/ai/sections";

/** Bump when wording below changes materially, so runs stay attributable. */
export const PLAN_PROMPT_VERSION = "plan/v1";
export const FILL_PROMPT_VERSION = "fill/v1";

/** System policy for the planner: turn a brief into a right-sized, section-grounded plan. */
export const PLAN_SYSTEM_PROMPT = `You are a presentation planner for a corporate pharmaceutical slide deck.

You are given the user's brief and a compact overview of a source document (a list of sections, each with an id, title, kind, and a short snippet).

Your job is to decide the slide plan:
- Let the BRIEF drive the number of slides. If the brief names N distinct topics (e.g. "the financial, functional and research info"), produce about N slides — one per topic. Do not pad the deck or force a fixed count.
- For each slide, choose the section id(s) whose content best supports it. Prefer a small, focused set of sections per slide. A cover/title slide may use no sections.
- Write a short intent (what the slide is about) and a working title for each slide.
- Optionally suggest an archetypeId from the available set when one clearly fits (e.g. a tabular/figures slide → a table archetype); otherwise omit it and let the system choose.
- Only reference section ids that appear in the overview. Never invent sections or facts here — this step only plans.

Respond with { "slides": [{ "intent", "title", "sectionIds", "archetypeId?" }, ...] } in reading order.`;

/** Assemble the planner's task message from the brief, overview, and available archetypes. */
export function buildPlanPrompt(
  brief: string,
  overview: TDocOverview,
  archetypeIds: Array<string>,
): string {
  const sections =
    overview.length > 0
      ? overview
          .map(
            (s) =>
              `- id: ${s.id} | kind: ${s.kind} | title: ${s.title || "(untitled)"}${
                s.snippet ? `\n    ${s.snippet}` : ""
              }`,
          )
          .join("\n")
      : "(no sections extracted)";

  return `Brief: ${brief}

Available archetype ids: ${archetypeIds.join(", ") || "(none)"}

Document overview (choose section ids from these only):
${sections}`;
}

/** The content kind the fill model must emit for a slot, derived from its role. */
export function expectedKind(role: TSlotRole): string {
  switch (role) {
    case "tableRow":
      return "labelValue";
    case "panel":
      return "panel";
    case "title":
    case "heading":
      return "lines";
    default:
      return "text";
  }
}

/** Slots the fill model writes content into — everything except pure-visual `block` slots. */
export function fillableSlots(archetype: IArchetype): Array<ISlot> {
  return archetype.slots.filter((slot) => slot.role !== "block");
}

/** System policy for the fill: pour selected content into the archetype's slots, grounded. */
export const FILL_SYSTEM_PROMPT = `You are a slide copywriter for a corporate pharmaceutical deck.

You are given one slide to fill: its intent, its layout slots (each with a slotId, role, the content "kind" it expects, and a size hint), the verbatim source content selected for this slide, and the deck's design tokens.

Rules:
- Write NEW, concise copy for each listed slot. Return one entry per slotId, tagged with the exact kind stated for that slot — never convert one kind into another:
  • text  → { "kind": "text", "text": "..." }
  • lines → { "kind": "lines", "lines": ["...", "..."] }        (a short list of lines)
  • labelValue → { "kind": "labelValue", "label": "...", "value": "..." }  (a table row)
  • panel → { "kind": "panel", "heading": "...", "body": "..." }
- Ground every FACT in the provided source content. Do NOT invent, and never emit numbers, doses, units, weight bands, product names, or DINs that do not appear verbatim in the source. If a figure isn't in the source, leave it out — write around it. Your own prior knowledge is not a source.
- Fit the slot: keep copy short enough for the size hint (titles a few words; table values a single figure; panel bodies one or two sentences). Match the deck's professional, clinical tone.
- Content only. You do not control geometry, colors, roles, or layout — those come from the archetype.

Respond with { "slots": [{ "slotId", "content" }, ...] } covering the listed slots.`;

/** Assemble the fill task message for one slide. */
export function buildFillPrompt(args: {
  intent: string;
  title: string;
  archetype: IArchetype;
  sections: Array<ISection>;
  tokens: ITokens;
  failureNote?: string;
}): string {
  const slots = fillableSlots(args.archetype)
    .map(
      (slot) =>
        `- slotId: ${slot.id} | role: ${slot.role} | kind: ${expectedKind(
          slot.role,
        )} | size ~${slot.w}×${slot.h}px`,
    )
    .join("\n");

  const source =
    args.sections.length > 0
      ? args.sections
          .map(
            (s) =>
              `### ${s.title || "(untitled)"} (section ${s.id})\n${s.content || "(no body)"}`,
          )
          .join("\n\n")
      : "(no source sections selected — write a concise, generic cover for the intent, with no invented figures)";

  const retry = args.failureNote
    ? `\nPrevious attempt was rejected — these values were NOT found in the source and must be removed or corrected: ${args.failureNote}\n`
    : "";

  return `Slide intent: ${args.intent}
Suggested title: ${args.title}
Layout: ${args.archetype.name} (${args.archetype.id})
${retry}
Fill these slots (one entry per slotId, using the stated kind and staying within the size hint):
${slots}

Source content — draw ALL facts and figures ONLY from here, invent nothing:
${source}

Design tone (brand cue): display font ${args.tokens.fonts.display}; body font ${args.tokens.fonts.body}; primary ${args.tokens.colors.primary}; accent ${args.tokens.colors.accent}.`;
}

/** Render grounding issues into a short note the retry pass can act on. */
export function describeGroundingIssues(
  issues: Array<IGroundingIssue>,
): string {
  return issues.map((i) => i.token).join(", ");
}

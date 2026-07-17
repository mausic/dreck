import type { ISection } from "@/lib/extract/section";
import type {
  IArchetype,
  IArchetypeDescriptor,
  ISlot,
  ITokens,
  TSlotRole,
} from "@/lib/slides/types";
import type { IGroundingIssue } from "#/lib/generate/schema";
import type { TDocOverview } from "#/lib/generate/sections";
import { slotCharBudget } from "@/lib/ai/fit";

export const PLAN_PROMPT_VERSION = "plan/v4";
export const FILL_PROMPT_VERSION = "fill/v1";

export const PLAN_SYSTEM_PROMPT = `You are a presentation planner for a corporate slide deck. You decide, for each slide, both what it covers AND which available layout (archetype) presents it best. Choosing the layout is a core part of your job, not an afterthought.

You are given the user's brief and a compact overview of a source document (a list of sections, each with an id, title, kind, and a short snippet).

Slide plan:
- Let the BRIEF drive the number of slides. If the brief names N distinct topics, produce about N slides — one per topic. Do not pad the deck or force a fixed count.
- Slide 1 is ALWAYS the cover: choose an available archetype whose category is "cover", with no sections.
- For each other slide choose the section id(s) whose content best supports it (a small, focused set). Write a short intent and a working title. Only reference section ids from the overview; invent nothing.

Choose an archetypeId for EVERY slide from the exact ids in the available-archetype list. Match its category and description to the SHAPE of the content: parallel-items for comparable items, metrics for headline numbers, mixed for lists plus prose, table for label-value data, statement for one key message, and section for a transition.

How to choose well:
- Actively look for chances to use parallel-items, metrics, and statement layouts — they make the deck varied and scannable.
- VARY the layouts. Do NOT use the same archetype on more than two slides unless the content truly leaves no alternative. A deck where most slides share one layout is wrong — spread the layouts out.
- The system validates your choice against the available catalog and basic content shape, overriding missing or structurally incompatible ids. Choose deliberately: a viable choice is honored.
- You may pick a slide's section(s) partly to enable a more distinctive layout, as long as they fit the slide's intent.

Respond with { "slides": [{ "intent", "title", "sectionIds", "archetypeId" }, ...] } in reading order.`;

export function buildPlanPrompt(
  brief: string,
  overview: TDocOverview,
  archetypes: Array<IArchetypeDescriptor>,
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

  const available = archetypes
    .map(
      (archetype) =>
        `- id: ${archetype.id} | category: ${archetype.category} | name: ${archetype.name}\n    ${archetype.description}`,
    )
    .join("\n");

  return `Brief: ${brief}

Available archetypes (use these exact ids only):
${available || "(none)"}

Document overview (choose section ids from these only):
${sections}`;
}

export function expectedKind(role: TSlotRole): string {
  switch (role) {
    case "tableRow":
      return "labelValue";
    case "panel":
      return "panel";
    case "title":
    case "heading":
    case "body":
      return "lines";
    default:
      return "text";
  }
}

export function fillableSlots(archetype: IArchetype): Array<ISlot> {
  return archetype.slots.filter((slot) => slot.role !== "block");
}

export const FILL_SYSTEM_PROMPT = `You are a slide copywriter for a corporate deck.

You are given one slide to fill: its intent, its layout slots (each with a slotId, role, the content "kind" it expects, and a size hint), the verbatim source content selected for this slide, and the deck's design tokens.

Rules:
- Write NEW, concise copy for each listed slot. Return one entry per slotId, tagged with the exact kind stated for that slot — never convert one kind into another:
  • text  → { "kind": "text", "text": "..." }
  • lines → { "kind": "lines", "lines": ["...", "..."] }        (a short list of lines)
  • labelValue → { "kind": "labelValue", "label": "...", "value": "..." }  (a table row)
  • panel → { "kind": "panel", "heading": "...", "body": "..." }
- Ground every FACT in the provided source content. Do NOT invent, and never emit numbers, doses, units, weight bands, product names, or DINs that do not appear verbatim in the source. If a figure isn't in the source, leave it out — write around it. Your own prior knowledge is not a source.
- STAY WITHIN THE CHARACTER BUDGET stated for each slot — the text is clipped if it overruns its box. Treat the budget as a hard limit: prefer fewer words, drop adjectives, and never pad. Match the deck's professional, clinical tone.
- Content only. You do not control geometry, colors, roles, or layout — those come from the archetype.

Respond with { "slots": [{ "slotId", "content" }, ...] } covering the listed slots.`;

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
        )} | ${slotCharBudget(slot)}`,
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

export function describeGroundingIssues(
  issues: Array<IGroundingIssue>,
): string {
  return issues.map((i) => i.token).join(", ");
}

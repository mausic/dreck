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
import { slotCharBudget } from "@/lib/ai/fit";

/** Bump when wording below changes materially, so runs stay attributable. */
export const PLAN_PROMPT_VERSION = "plan/v3";
export const FILL_PROMPT_VERSION = "fill/v1";

/** System policy for the planner: turn a brief into a right-sized, section-grounded plan. */
export const PLAN_SYSTEM_PROMPT = `You are a presentation planner for a corporate slide deck. You decide, for each slide, both what it covers AND which layout (archetype) presents it best. Choosing the layout is a core part of your job, not an afterthought.

You are given the user's brief and a compact overview of a source document (a list of sections, each with an id, title, kind, and a short snippet).

Slide plan:
- Let the BRIEF drive the number of slides. If the brief names N distinct topics, produce about N slides — one per topic. Do not pad the deck or force a fixed count.
- Slide 1 is ALWAYS the cover: archetypeId "title", no sections.
- For each other slide choose the section id(s) whose content best supports it (a small, focused set). Write a short intent and a working title. Only reference section ids from the overview; invent nothing.

Choose an archetypeId for EVERY slide — never leave it blank. Match the SHAPE of the slide's content:
- "title" — the opening cover only (slide 1).
- "card-grid" — 2–4 parallel, comparable items shown side by side (product forms, options, patient groups, categories). Use this whenever a section lists a few comparable things.
- "stat" — the message is 1–3 headline NUMBERS (a percentage, a dose, a duration) with little surrounding text.
- "two-column" — a list of points PLUS a paragraph that explains or frames them.
- "table-sidebar" — many label→value pairs or a data table (e.g. weight→dose rows).
- "callout" — a single strong statement: a key warning, a caution, a takeaway, or a quote.
- "section-divider" — a pure transition / part break with almost no content.

How to choose well:
- Actively look for chances to use card-grid, stat and callout — they make the deck varied and scannable. Before defaulting to a list, ask: are these comparable items (card-grid)? is there a headline number (stat)? is there a warning or key message (callout)?
- VARY the layouts. Do NOT use the same archetype on more than two slides unless the content truly leaves no alternative. A deck where most slides share one layout is wrong — spread the layouts out.
- The system keeps any choice that is structurally viable for the content and only overrides one that is impossible (e.g. "stat" with no numbers, "card-grid" with fewer than two items). So choose deliberately: a viable choice is always honored.
- You may pick a slide's section(s) partly to enable a more distinctive layout, as long as they fit the slide's intent.

Respond with { "slides": [{ "intent", "title", "sectionIds", "archetypeId" }, ...] } in reading order.`;

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

Available archetype families: ${archetypeIds.join(", ") || "(none)"}

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
    case "body":
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

/** Render grounding issues into a short note the retry pass can act on. */
export function describeGroundingIssues(
  issues: Array<IGroundingIssue>,
): string {
  return issues.map((i) => i.token).join(", ");
}

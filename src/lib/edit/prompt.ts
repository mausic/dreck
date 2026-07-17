import type { TEditModelData } from "@/lib/edit/schema";
import type { TSlotContent } from "@/lib/slides/types";
import { isLabelValue, isPanelContent } from "@/lib/slides/content";

export const EDIT_PROMPT_VERSION = "edit/v1";

export const EDIT_SYSTEM_PROMPT = `You are a precise copy editor for a corporate slide deck.

You are given one or more selected slide elements (each with an id, a role, its content shape, and its current content), the user's edit instruction, read-only text from the rest of the slide for context, and the deck's design tokens.

Rules:
- Apply the instruction to the content of the selected element(s) ONLY. Return updated content for each given element id and nothing else. Never invent, rename, or drop element ids.
- Preserve the SHAPE of each element exactly. Return content tagged with its "kind":
  • text  → { "kind": "text", "text": "..." }                 (single line/paragraph)
  • lines → { "kind": "lines", "lines": ["...", "..."] }        (a list of lines)
  • labelValue → { "kind": "labelValue", "label": "...", "value": "..." }  (a table row)
  • panel → { "kind": "panel", "heading": "...", "body": "..." }
  Always return the SAME kind the element already has — never convert one shape into another.
- Stay on-brand: match the professional, clinical tone of the deck and keep copy concise enough to fit the element's role.
- Do NOT invent facts. Never add, remove, or alter numbers, doses, units, product names, or DINs unless the instruction explicitly asks you to change that specific value. When unsure, keep the figure exactly as given.
- Rewrite text only — never touch layout, geometry, colors, or roles.

Respond with { "updates": [{ "elementId", "content" }, ...] } covering exactly the given element ids.`;

function contentKind(content: TSlotContent): string {
  if (typeof content === "string") return "text";
  if (Array.isArray(content)) return "lines";
  if (isLabelValue(content)) return "labelValue";
  if (isPanelContent(content)) return "panel";
  return "text";
}

export function buildEditPrompt(data: TEditModelData): string {
  const targets = data.targets
    .map(
      (t) =>
        `- id: ${t.id}\n  role: ${t.role}\n  kind: ${contentKind(
          t.content,
        )}\n  current content: ${JSON.stringify(t.content)}`,
    )
    .join("\n");

  const context =
    data.context.length > 0
      ? data.context.map((line) => `- ${line}`).join("\n")
      : "(none)";

  const brand = data.tokens
    ? `Display font: ${data.tokens.fonts.display}; body font: ${data.tokens.fonts.body}; primary color: ${data.tokens.colors.primary}; accent: ${data.tokens.colors.accent}.`
    : "(none provided)";

  return `Instruction: ${data.instruction}

Editable elements (rewrite these — return one update per id, same kind):
${targets}

Read-only context from the rest of the slide (do not edit; for coherence only):
${context}

Design tokens (brand tone cue): ${brand}`;
}

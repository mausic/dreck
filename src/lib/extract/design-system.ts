/**
 * Design-system extraction: deterministic fonts and page count plus model-derived visual details.
 * Every PDF page receives one archetype detail call; no model decides which pages are worth keeping.
 */
import {
  NoObjectGeneratedError,
  NoOutputGeneratedError,
  Output,
  generateText,
} from "ai";
import { z } from "zod";
import type {
  IExtractedArchetype,
  ITokens,
  TArchetypeCategory,
} from "@/lib/slides/types";
import type { IRawExtractedArchetype } from "@/lib/extract/enhance-archetypes";
import { ARCHETYPE_CATEGORIES } from "@/lib/slides/types";
import { DESIGN_TOKENS } from "@/lib/slides/tokens";
import { STYLE_REFS } from "@/lib/slides/styles";
import { ExtractedArchetypesSchema } from "@/lib/slides/archetype-schema";
import { getArchetype } from "@/lib/slides/archetypes";
import { getDesignModel } from "@/lib/ai/model";
import { runWithConcurrency } from "@/lib/ai/concurrency";
import { isFatalProviderError, withModelRetry } from "@/lib/ai/retry";
import { enhanceExtractedArchetypes } from "@/lib/extract/enhance-archetypes";
import { extractFonts } from "@/lib/extract/fonts";

const HexColorSchema = z.string().regex(/^#[0-9a-f]{6}$/i);
const PaletteSchema = z.object({
  colors: z.object({
    primary: HexColorSchema,
    surface: HexColorSchema,
    accent: HexColorSchema,
    white: HexColorSchema,
    textDark: HexColorSchema,
    textMuted: HexColorSchema,
  }),
  feel: z.string(),
});

const RawExtractedSlotSchema = z.object({
  id: z.string(),
  role: z.string(),
  x: z.number(),
  y: z.number(),
  w: z.number(),
  h: z.number(),
  styleRef: z.string(),
});

const PageArchetypeSchema = z.object({
  name: z.string().min(1).max(80),
  category: z.enum(ARCHETYPE_CATEGORIES),
  description: z.string().min(1).max(240),
  slots: z.array(RawExtractedSlotSchema).min(2).max(40),
});

type TPageOutcome =
  | { ok: true; page: number; archetype: IExtractedArchetype }
  | { ok: false; page: number; error: unknown };

interface IPageExtractionResult {
  archetypes: Array<IExtractedArchetype>;
  fallbackPages: Array<number>;
}

export interface IExtractedDesignSystem {
  tokens: ITokens;
  archetypes: Array<IExtractedArchetype>;
  feel: string;
}

const PALETTE_SYSTEM_PROMPT = `Read the attached presentation template and report its visual design system.

Return the actual six-digit hex colors for these roles: primary, surface, accent, white, textDark,
and textMuted. Also return one or two sentences describing spacing rhythm and rule/eyebrow treatment.
Do not return fonts, page metadata, content, or layouts.`;

const PAGE_ARCHETYPE_SYSTEM_PROMPT = `Extract a reusable layout skeleton from one specified PDF page.

Recreate composition, not content: every source text region becomes an empty semantic slot and no
source-deck wording may appear. Use integer coordinates in a fixed 1440×810 canvas.

Rules:
- Return a semantic name, category, short layout description, and ordered slots.
- Categories are cover, section, statement, parallel-items, metrics, table, or mixed.
- Slot ids must be descriptive kebab-case and unique.
- Roles are logo, eyebrow, title, subtitle, heading, body, block, tableRow, panel, footer, or custom.
- Use block for backgrounds, cards, panels, and rules; blocks receive no generated copy.
- Preserve paint order: large backgrounds first, then smaller blocks, then text.
- Keep every slot within the canvas.
- Use the closest style from the supplied list; never invent a style reference.`;

const STRUCTURED_ATTEMPTS = 2;
const PAGE_CONCURRENCY = 2;

class StructuredValidationError extends Error {
  constructor(message: string, cause?: unknown) {
    super(message, { cause });
    this.name = "StructuredValidationError";
  }
}

/** Count page objects directly from PDF syntax, with the page-tree Count as a fallback. */
export function countPdfPages(pdfBytes: Uint8Array): number {
  const source = new TextDecoder("latin1").decode(pdfBytes);
  const pageObjects = source.match(/\/Type\s*\/Page\b/g)?.length ?? 0;
  if (pageObjects > 0) return pageObjects;
  const counts = [...source.matchAll(/\/Count\s+(\d+)/g)].map((match) =>
    Number.parseInt(match[1], 10),
  );
  const pageCount = counts.length > 0 ? Math.max(...counts) : 0;
  if (pageCount < 1)
    throw new Error("Could not determine the design PDF page count.");
  return pageCount;
}

async function withStructuredRetry<TResult>(
  run: () => Promise<TResult>,
): Promise<TResult> {
  let lastError: unknown;
  for (let attempt = 0; attempt < STRUCTURED_ATTEMPTS; attempt++) {
    try {
      return await withModelRetry(run);
    } catch (error) {
      if (isFatalProviderError(error)) throw error;
      if (
        !NoObjectGeneratedError.isInstance(error) &&
        !NoOutputGeneratedError.isInstance(error) &&
        !(error instanceof StructuredValidationError)
      ) {
        throw error;
      }
      lastError = error;
    }
  }
  throw lastError;
}

async function extractPalette(pdfBytes: Uint8Array): Promise<{
  colors: ITokens["colors"];
  feel: string;
}> {
  return withStructuredRetry(async () => {
    const result = await generateText({
      model: getDesignModel(),
      output: Output.object({ schema: PaletteSchema }),
      system: PALETTE_SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: "Extract the template palette and feel." },
            { type: "file", data: pdfBytes, mediaType: "application/pdf" },
          ],
        },
      ],
      maxRetries: 0,
    });
    return result.output;
  });
}

function buildPagePrompt(page: number): string {
  return `Extract the layout from PDF page ${page}. Process that page only.

Allowed style references:
${STYLE_REFS.join(", ")}

Style families: title/* is for dark covers; content/* is for light-slide headers; card/* is for
comparison cards; twocol/* is for split content; stat/* is for figures; divider/* is for section
breaks; callout/* is for statements; sidebar/* is for tables and dark side panels.`;
}

async function extractPageArchetype(
  pdfBytes: Uint8Array,
  page: number,
): Promise<IExtractedArchetype> {
  return withStructuredRetry(async () => {
    const result = await generateText({
      model: getDesignModel(),
      output: Output.object({ schema: PageArchetypeSchema }),
      system: PAGE_ARCHETYPE_SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: buildPagePrompt(page) },
            { type: "file", data: pdfBytes, mediaType: "application/pdf" },
          ],
        },
      ],
      maxRetries: 0,
    });
    const detail = result.output;
    const category: TArchetypeCategory =
      page === 1
        ? "cover"
        : detail.category === "cover"
          ? "mixed"
          : detail.category;
    const raw: IRawExtractedArchetype = {
      id: `page-${page}-layout`,
      name: detail.name,
      category,
      description: detail.description,
      slots: detail.slots,
    };
    try {
      return enhanceExtractedArchetypes([raw], {
        validateCatalog: false,
      }).archetypes[0];
    } catch (error) {
      throw new StructuredValidationError(
        `Page ${page} layout was not mechanically usable.`,
        error,
      );
    }
  });
}

const CONTENT_FALLBACKS = [
  { id: "two-column", category: "mixed" },
  { id: "card-grid-3", category: "parallel-items" },
  { id: "table-sidebar", category: "table" },
  { id: "stat-3", category: "metrics" },
  { id: "callout", category: "statement" },
] as const;

function fallbackForPage(page: number): IExtractedArchetype {
  const fallback =
    page === 1
      ? { id: "title", category: "cover" as const }
      : CONTENT_FALLBACKS[(page - 2) % CONTENT_FALLBACKS.length];
  const archetype = getArchetype(fallback.id);
  if (!archetype)
    throw new Error(`Missing built-in archetype '${fallback.id}'.`);
  return {
    ...archetype,
    id: `page-${page}-fallback`,
    name: `Page ${page} fallback`,
    category: fallback.category,
    description: `Built-in fallback because page ${page} could not be extracted.`,
    slots: archetype.slots.map((slot) => ({ ...slot })),
  };
}

async function extractEveryPage(
  pdfBytes: Uint8Array,
  pageCount: number,
): Promise<IPageExtractionResult> {
  const tasks = Array.from({ length: pageCount }, (_, index) => {
    const page = index + 1;
    return async (): Promise<TPageOutcome> => {
      try {
        return {
          ok: true,
          page,
          archetype: await extractPageArchetype(pdfBytes, page),
        };
      } catch (error) {
        return { ok: false, page, error };
      }
    };
  });
  const archetypes: Array<IExtractedArchetype | undefined> = Array.from({
    length: pageCount,
  });
  const fallbackPages: Array<number> = [];

  for await (const outcome of runWithConcurrency(tasks, PAGE_CONCURRENCY)) {
    if (outcome.ok) {
      archetypes[outcome.page - 1] = outcome.archetype;
      continue;
    }
    if (isFatalProviderError(outcome.error)) throw outcome.error;
    archetypes[outcome.page - 1] = fallbackForPage(outcome.page);
    fallbackPages.push(outcome.page);
  }

  if (archetypes.length === 1) archetypes.push(fallbackForPage(2));
  return {
    archetypes: ExtractedArchetypesSchema.parse(archetypes),
    fallbackPages,
  };
}

export async function extractDesignSystem(
  pdfBytes: Uint8Array,
): Promise<IExtractedDesignSystem> {
  const fonts = extractFonts(pdfBytes);
  const pageCount = countPdfPages(pdfBytes);
  let palette: { colors: ITokens["colors"]; feel: string };
  try {
    palette = await extractPalette(pdfBytes);
  } catch (error) {
    if (isFatalProviderError(error)) throw error;
    palette = {
      colors: DESIGN_TOKENS.colors,
      feel: "Palette extraction failed; default colors were used.",
    };
  }
  const { archetypes, fallbackPages } = await extractEveryPage(
    pdfBytes,
    pageCount,
  );
  const fallbackNote =
    fallbackPages.length > 0
      ? ` Page fallbacks used for: ${fallbackPages.join(", ")}.`
      : "";
  return {
    tokens: {
      colors: palette.colors,
      fonts: {
        display: fonts.display ?? DESIGN_TOKENS.fonts.display,
        body: fonts.body ?? DESIGN_TOKENS.fonts.body,
      },
    },
    feel: `${palette.feel}${fallbackNote}`,
    archetypes,
  };
}

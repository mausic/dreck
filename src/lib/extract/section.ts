/**
 * The generic, domain-neutral section tree that Stage 2 of extraction produces.
 *
 * Same discipline the slide model already uses (`TSlotRole`, `TArchetypeId`): the
 * *vocabulary* is open — `title`, `kind` and `content` are free-form strings the
 * extractor fills with whatever the document yields ("overview", "dosing",
 * "methodology", …) — but the *shape* is strict: a document is a strongly-typed,
 * recursive tree of sections. No `any`, no untyped JSON blob. Loose where the domain
 * lives; tight where the pipeline connects.
 *
 * `content` is verbatim markdown taken from under the heading (tables included), never
 * an LLM rewrite — this is what a later grounding step checks generated slides against.
 */
import { z } from "zod";

/** One node of the section tree. `children` present only when the heading nests deeper ones. */
export interface ISection {
  /** Deterministic structural id — the dotted heading path, e.g. `"1"`, `"1.2"`, `"1.2.3"`. */
  id: string;
  /** Verbatim heading text. Open vocabulary — not an enum. */
  title: string;
  /** Open label for the section (slugified title by default). Never touches title/content. */
  kind: string;
  /** Verbatim markdown body under this heading, before its first child heading. Tables intact. */
  content: string;
  /** Nested subsections, when the document nests deeper headings under this one. */
  children?: Array<ISection>;
}

/**
 * Recursive Zod schema for {@link ISection}. `z.lazy` ties the knot for the self-reference;
 * the explicit `z.ZodType<ISection>` annotation keeps the inferred type aligned with the
 * hand-written interface. Strict in shape, open in string vocabulary.
 */
export const SectionSchema: z.ZodType<ISection> = z.lazy(() =>
  z.object({
    id: z.string(),
    title: z.string(),
    kind: z.string(),
    content: z.string(),
    children: z.array(SectionSchema).optional(),
  }),
);

/** The document-level forest: a document parses to an ordered list of root sections. */
export const SectionTreeSchema = z.array(SectionSchema);

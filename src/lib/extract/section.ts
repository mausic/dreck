import { z } from "zod";

export interface ISection {
  /** Deterministic structural id — the dotted heading path, e.g. `"1"`, `"1.2"`, `"1.2.3"`. */
  id: string;
  /** Verbatim heading text */
  title: string;
  /** Open label for the section (slugified title by default). Never touches title/content. */
  kind: string;
  /** Verbatim markdown body under this heading, before its first child heading. Tables intact. */
  content: string;
  /** Nested subsections, when the document nests deeper headings under this one. */
  children?: Array<ISection>;
}

export const SectionSchema: z.ZodType<ISection> = z.lazy(() =>
  z.object({
    id: z.string(),
    title: z.string(),
    kind: z.string(),
    content: z.string(),
    children: z.array(SectionSchema).optional(),
  }),
);

export const SectionTreeSchema = z.array(SectionSchema);

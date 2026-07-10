/**
 * Stage 2 of extraction: deterministic markdown → generic {@link ISection} tree.
 *
 * No LLM, no rewriting. The heading structure of the markdown (ATX `#`…`######`) is the
 * only signal; each section's `content` is the verbatim body under its heading, up to the
 * first deeper heading. Determinism is the point: "content comes only from the PDF" and a
 * later grounding step both depend on section bodies being byte-faithful to the markdown.
 *
 * Tables need no special handling — a markdown table is just a run of body lines that
 * flows verbatim into the enclosing section, rows and all.
 */
import type { ISection } from "@/lib/extract/section";

/** ATX heading: up to 3 leading spaces, 1–6 `#`, at least one space, text, optional closing `#`s. */
const HEADING_RE = /^ {0,3}(#{1,6})[ \t]+(.*?)[ \t]*#*[ \t]*$/;
/** A fenced-code delimiter line (``` or ~~~). Toggles "inside code" so `#` there isn't a heading. */
const FENCE_RE = /^ {0,3}(```|~~~)/;

/** Mutable builder node; collapsed to the immutable {@link ISection} once fully populated. */
interface IBuildNode {
  id: string; // assigned in a second pass once the tree shape is known
  title: string;
  kind: string;
  level: number; // heading level 1–6; the optional preamble root uses 0
  contentLines: Array<string>;
  children: Array<IBuildNode>;
}

/**
 * Slugify a heading into an open `kind` label: lowercase, links unwrapped, emphasis
 * stripped, non-alphanumeric runs collapsed to single dashes. Falls back to `"section"`
 * so `kind` is never empty. This is the default labeller; an LLM kind-only pass could
 * refine it later, but it may never touch `title` or `content`.
 */
export function slugify(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1") // [text](url) -> text
    .replace(/[`*_~]/g, "") // strip md emphasis markers
    .replace(/&[a-z]+;/g, " ") // html entities -> space
    .replace(/[^a-z0-9]+/g, "-") // non-alphanumeric -> dash
    .replace(/^-+|-+$/g, ""); // trim leading/trailing dashes
  return slug.length > 0 ? slug : "section";
}

/** Drop blank lines from the top and bottom of a block, keeping interior formatting intact. */
function trimBlankEdges(lines: Array<string>): Array<string> {
  let start = 0;
  let end = lines.length;
  while (start < end && lines[start].trim() === "") start += 1;
  while (end > start && lines[end - 1].trim() === "") end -= 1;
  return lines.slice(start, end);
}

/** Assign deterministic dotted ids by sibling position: `1`, `1.1`, `1.2`, `2`, … */
function assignIds(nodes: Array<IBuildNode>, prefix: string): void {
  nodes.forEach((node, index) => {
    const id = prefix ? `${prefix}.${index + 1}` : `${index + 1}`;
    node.id = id;
    if (node.children.length > 0) assignIds(node.children, id);
  });
}

/** Collapse a fully-built node into the public {@link ISection} shape (content computed here). */
function finalize(node: IBuildNode): ISection {
  const content = trimBlankEdges(node.contentLines).join("\n");
  const section: ISection = {
    id: node.id,
    title: node.title,
    kind: node.kind,
    content,
  };
  if (node.children.length > 0) {
    section.children = node.children.map(finalize);
  }
  return section;
}

/**
 * Parse faithful markdown into a generic section forest.
 *
 * Stack algorithm: at a heading of level L, pop open ancestors whose level ≥ L, attach the
 * new section under the new top (or as a root), then route following non-heading lines into
 * the deepest open section. A parent's `content` is therefore only its own intro text before
 * its first child heading — no duplication across levels. Content appearing before the first
 * heading (if any) becomes a leading `"preamble"` root so nothing is dropped.
 */
export function parseSections(markdown: string): Array<ISection> {
  const lines = markdown.split("\n");
  const roots: Array<IBuildNode> = [];
  const stack: Array<IBuildNode> = [];
  const preambleLines: Array<string> = [];
  let inFence = false;

  const pushContent = (line: string): void => {
    if (stack.length > 0) stack[stack.length - 1].contentLines.push(line);
    else preambleLines.push(line);
  };

  for (const line of lines) {
    if (FENCE_RE.test(line)) {
      inFence = !inFence;
      pushContent(line); // the fence delimiter itself is body content
      continue;
    }

    const heading = inFence ? null : HEADING_RE.exec(line);
    if (heading) {
      const level = heading[1].length;
      const title = heading[2].trim();
      const node: IBuildNode = {
        id: "",
        title,
        kind: slugify(title),
        level,
        contentLines: [],
        children: [],
      };
      while (stack.length > 0 && stack[stack.length - 1].level >= level) {
        stack.pop();
      }
      if (stack.length > 0) stack[stack.length - 1].children.push(node);
      else roots.push(node);
      stack.push(node);
      continue;
    }

    pushContent(line);
  }

  const preamble = trimBlankEdges(preambleLines);
  if (preamble.length > 0) {
    roots.unshift({
      id: "",
      title: "Preamble",
      kind: "preamble",
      level: 0,
      contentLines: preamble,
      children: [],
    });
  }

  assignIds(roots, "");
  return roots.map(finalize);
}

import type { ISection } from "@/lib/extract/section";

const HEADING_RE = /^ {0,3}(#{1,6})[ \t]+(.*?)[ \t]*#*[ \t]*$/;
const FENCE_RE = /^ {0,3}(```|~~~)/;

interface IBuildNode {
  id: string; // assigned in a second pass once the tree shape is known
  title: string;
  kind: string;
  level: number; // heading level 1–6; the optional preamble root uses 0
  contentLines: Array<string>;
  children: Array<IBuildNode>;
}

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

function trimBlankEdges(lines: Array<string>): Array<string> {
  let start = 0;
  let end = lines.length;
  while (start < end && lines[start].trim() === "") start += 1;
  while (end > start && lines[end - 1].trim() === "") end -= 1;
  return lines.slice(start, end);
}

function assignIds(nodes: Array<IBuildNode>, prefix: string): void {
  nodes.forEach((node, index) => {
    const id = prefix ? `${prefix}.${index + 1}` : `${index + 1}`;
    node.id = id;
    if (node.children.length > 0) assignIds(node.children, id);
  });
}

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

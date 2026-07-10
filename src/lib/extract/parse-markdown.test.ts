import { describe, expect, it } from "vitest";
import { parseSections, slugify } from "@/lib/extract/parse-markdown";

describe("slugify", () => {
  it("lowercases and dashes non-alphanumerics", () => {
    expect(slugify("Dosage & Administration")).toBe("dosage-administration");
  });

  it("unwraps links and strips emphasis", () => {
    expect(slugify("**See [details](http://x)**")).toBe("see-details");
  });

  it("falls back to 'section' when nothing survives", () => {
    expect(slugify("!!!")).toBe("section");
  });
});

describe("parseSections", () => {
  it("nests headings by level into a tree", () => {
    const md = [
      "# Overview",
      "Intro text.",
      "## Dosing",
      "Take one.",
      "### Adults",
      "500 mg.",
      "## Storage",
      "Keep cool.",
    ].join("\n");

    const tree = parseSections(md);
    expect(tree).toHaveLength(1);

    const overview = tree[0];
    expect(overview).toMatchObject({
      id: "1",
      title: "Overview",
      kind: "overview",
    });
    expect(overview.content).toBe("Intro text.");
    expect(overview.children).toHaveLength(2);

    const [dosing, storage] = overview.children!;
    expect(dosing).toMatchObject({ id: "1.1", title: "Dosing" });
    expect(dosing.content).toBe("Take one.");
    expect(dosing.children).toHaveLength(1);
    expect(dosing.children![0]).toMatchObject({
      id: "1.1.1",
      title: "Adults",
      content: "500 mg.",
    });
    expect(storage).toMatchObject({
      id: "1.2",
      title: "Storage",
      content: "Keep cool.",
    });
    expect(storage.children).toBeUndefined();
  });

  it("keeps a markdown table verbatim inside its section content", () => {
    const table = [
      "| Weight | Dose |",
      "| --- | --- |",
      "| 10 kg | 150 mg |",
      "| 20 kg | 300 mg |",
    ].join("\n");
    const md = `## Dosing table\n\n${table}\n`;

    const [section] = parseSections(md);
    // Row↔dose associations preserved byte-for-byte.
    expect(section.content).toBe(table);
  });

  it("captures pre-heading content as a leading preamble root", () => {
    const md = ["Some front matter.", "", "# Real Section", "Body."].join("\n");
    const tree = parseSections(md);

    expect(tree).toHaveLength(2);
    expect(tree[0]).toMatchObject({
      id: "1",
      title: "Preamble",
      kind: "preamble",
      content: "Some front matter.",
    });
    expect(tree[1]).toMatchObject({
      id: "2",
      title: "Real Section",
      content: "Body.",
    });
  });

  it("does not treat '#' inside a fenced code block as a heading", () => {
    const md = ["# Title", "```", "# not a heading", "```", "after"].join("\n");
    const tree = parseSections(md);

    expect(tree).toHaveLength(1);
    expect(tree[0].children).toBeUndefined();
    expect(tree[0].content).toBe("```\n# not a heading\n```\nafter");
  });

  it("a parent's content stops at its first child heading", () => {
    const md = ["# A", "line one", "line two", "## B", "child body"].join("\n");
    const [a] = parseSections(md);
    expect(a.content).toBe("line one\nline two");
    expect(a.children![0].content).toBe("child body");
  });

  it("returns an empty forest for whitespace-only input", () => {
    expect(parseSections("   \n\n  ")).toEqual([]);
  });
});

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { extractFonts } from "@/lib/extract/fonts";

const DESIGN_PDF = new Uint8Array(
  readFileSync("docs/Pharma_training_presentation_design.pdf"),
);

describe("extractFonts (real design PDF)", () => {
  const result = extractFonts(DESIGN_PDF);

  it("finds the deck's real families with subset prefixes stripped", () => {
    const names = result.families.map((f) => f.family);
    expect(names).toContain("IBM Plex Sans");
    expect(names).toContain("Libre Franklin");
    // Subset prefixes (AAAAAA+) must not survive.
    expect(names.every((n) => !/^[A-Z]{6}\+/.test(n))).toBe(true);
  });

  it("assigns Libre Franklin to display and IBM Plex Sans to body", () => {
    expect(result.display).toContain("Libre Franklin");
    expect(result.body).toContain("IBM Plex Sans");
  });

  it("produces usable CSS font-family stacks with a fallback", () => {
    expect(result.display).toMatch(/system-ui/);
    expect(result.body).toMatch(/sans-serif/);
  });
});

describe("extractFonts (edge cases)", () => {
  it("returns no roles for bytes with no font info", () => {
    const result = extractFonts(new TextEncoder().encode("not a pdf"));
    expect(result.families).toHaveLength(0);
    expect(result.display).toBeUndefined();
    expect(result.body).toBeUndefined();
  });
});

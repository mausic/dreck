import { describe, expect, it } from "vitest";
import { countPdfPages } from "@/lib/extract/design-system";

function pdfBytes(source: string): Uint8Array {
  return new TextEncoder().encode(source);
}

describe("countPdfPages", () => {
  it("counts page objects without confusing the Pages tree", () => {
    const source = `
      1 0 obj << /Type /Pages /Count 3 >> endobj
      2 0 obj << /Type /Page /Parent 1 0 R >> endobj
      3 0 obj << /Type /Page /Parent 1 0 R >> endobj
      4 0 obj << /Type /Page /Parent 1 0 R >> endobj
    `;
    expect(countPdfPages(pdfBytes(source))).toBe(3);
  });

  it("falls back to the largest page-tree count", () => {
    expect(countPdfPages(pdfBytes("<< /Type /Pages /Count 4 >>"))).toBe(4);
  });

  it("rejects a PDF whose page count cannot be determined", () => {
    expect(() => countPdfPages(pdfBytes("%PDF-1.4"))).toThrow();
  });
});

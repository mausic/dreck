import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";

import {
  MAX_DESIGN_PAGES,
  buildIsolatedPagePrompt,
  countPdfPages,
  prepareDesignPages,
} from "@/lib/extract/design-system";

async function pdfBytes(pageCount: number): Promise<Uint8Array> {
  const document = await PDFDocument.create();
  for (let index = 0; index < pageCount; index++) document.addPage();
  return document.save();
}

describe("countPdfPages", () => {
  it("reads the page tree through a PDF parser", async () => {
    expect(await countPdfPages(await pdfBytes(3))).toBe(3);
  });

  it("creates one isolated PDF per design page", async () => {
    const pages = await prepareDesignPages(await pdfBytes(3));
    expect(pages).toHaveLength(3);
    await expect(Promise.all(pages.map(countPdfPages))).resolves.toEqual([
      1, 1, 1,
    ]);
  });

  it("rejects malformed and oversized design PDFs before model calls", async () => {
    await expect(
      countPdfPages(new TextEncoder().encode("%PDF-1.4")),
    ).rejects.toThrow("could not be parsed");
    await expect(
      prepareDesignPages(await pdfBytes(MAX_DESIGN_PAGES + 1)),
    ).rejects.toThrow(`limited to ${MAX_DESIGN_PAGES} pages`);
  });
});

describe("buildIsolatedPagePrompt", () => {
  it("addresses the isolated attachment as page one", () => {
    const prompt = buildIsolatedPagePrompt(4);

    expect(prompt).toContain("copied from source page 4");
    expect(prompt).toContain("PDF page 1");
    expect(prompt).not.toContain("PDF page 4");
  });
});

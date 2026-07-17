import { describe, expect, it, vi } from "vitest";

import type { TStoredDeck } from "@/lib/decks/schema";
import type { IBrowserPdfBinding } from "@/lib/decks/pdf-response";
import {
  createDeckPdfResponse,
  deckPdfFilename,
} from "@/lib/decks/pdf-response";
import { DESIGN_TOKENS } from "@/lib/slides/tokens";

const DECK_ID = "00000000-0000-4000-8000-000000000001";

function storedDeck(slides = 1): TStoredDeck {
  return {
    id: DECK_ID,
    prompt: "Dosing & safety overview",
    status: "complete",
    contentSourceName: "reference.pdf",
    expectedSlideCount: slides,
    generatedSlideCount: slides,
    error: null,
    createdAt: new Date("2026-07-17T00:00:00Z"),
    updatedAt: new Date("2026-07-17T00:00:00Z"),
    tokens: DESIGN_TOKENS,
    slides: Array.from({ length: slides }, (_, index) => ({
      index,
      revision: 0,
      grounding: { ok: true, issues: [] },
      slide: {
        id: `slide-${index + 1}`,
        archetypeId: "statement",
        elements: [],
      },
    })),
  };
}

describe("deckPdfFilename", () => {
  it("creates a safe attachment filename", () => {
    expect(deckPdfFilename("Dösing & safety / overview", DECK_ID)).toBe(
      "dosing-safety-overview.pdf",
    );
    expect(deckPdfFilename("---", DECK_ID)).toBe("deck-00000000.pdf");
  });
});

describe("createDeckPdfResponse", () => {
  it("streams a successful Browser Run PDF with download headers", async () => {
    let options: BrowserRunPDFOptions | undefined;
    const browser: IBrowserPdfBinding = {
      quickAction: (_action, nextOptions) => {
        options = nextOptions;
        return Promise.resolve(
          new Response("%PDF-1.7", {
            headers: { "Content-Type": "application/pdf" },
          }),
        );
      },
    };

    const response = await createDeckPdfResponse(DECK_ID, {
      browser,
      loadDeck: () => Promise.resolve(storedDeck(2)),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/pdf");
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(response.headers.get("Content-Disposition")).toContain(
      'filename="dosing-safety-overview.pdf"',
    );
    expect(await response.text()).toBe("%PDF-1.7");
    expect(options).toMatchObject({
      cacheTTL: 0,
      viewport: { width: 1280, height: 720 },
      waitForSelector: { selector: "[data-pdf-ready]" },
      pdfOptions: {
        width: "1280px",
        height: "720px",
        preferCSSPageSize: true,
        printBackground: true,
      },
    });
    expect("html" in (options ?? {})).toBe(true);
  });

  it("rejects invalid, missing, and empty decks before Browser Run", async () => {
    const quickAction = vi.fn<IBrowserPdfBinding["quickAction"]>();
    const browser: IBrowserPdfBinding = { quickAction };
    const invalid = await createDeckPdfResponse("not-a-uuid", {
      browser,
      loadDeck: () => Promise.resolve(storedDeck()),
    });
    const missing = await createDeckPdfResponse(DECK_ID, {
      browser,
      loadDeck: () => Promise.resolve(null),
    });
    const empty = await createDeckPdfResponse(DECK_ID, {
      browser,
      loadDeck: () => Promise.resolve(storedDeck(0)),
    });

    expect(invalid.status).toBe(400);
    expect(missing.status).toBe(404);
    expect(empty.status).toBe(422);
    expect(quickAction).not.toHaveBeenCalled();
  });

  it("returns a generic gateway error when Browser Run fails", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    const response = await createDeckPdfResponse(DECK_ID, {
      browser: {
        quickAction: () =>
          Promise.resolve(new Response("provider detail", { status: 503 })),
      },
      loadDeck: () => Promise.resolve(storedDeck()),
    });

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({
      error: "PDF generation is temporarily unavailable.",
    });
    expect(consoleError).toHaveBeenCalledWith(
      expect.stringContaining('"stage":"browser"'),
    );
    consoleError.mockRestore();
  });
});

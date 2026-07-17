import { z } from "zod";

import type { TStoredDeck } from "@/lib/decks/schema";
import {
  PDF_PAGE_SIZE,
  renderDeckPdfHtml,
} from "@/components/slides/pdf-deck-document";

const PDF_TIMEOUT_MS = 60_000;
const FONT_READY_SCRIPT = `document.fonts.ready.then(function () {
  document.body.setAttribute("data-pdf-ready", "true");
});`;

export interface IBrowserPdfBinding {
  quickAction: (
    action: "pdf",
    options: BrowserRunPDFOptions,
  ) => Promise<Response>;
}

export interface IDeckPdfDependencies {
  browser: IBrowserPdfBinding;
  loadDeck: (deckId: string) => Promise<TStoredDeck | null>;
}

function errorResponse(error: string, status: number): Response {
  return Response.json({ error }, { status });
}

function logPdfError(stage: string, error: unknown): void {
  console.error(
    JSON.stringify({
      message: "deck PDF generation failed",
      stage,
      error: error instanceof Error ? error.message : String(error),
    }),
  );
}

export function deckPdfFilename(prompt: string, deckId: string): string {
  const slug = prompt
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
  return `${slug || `deck-${deckId.slice(0, 8)}`}.pdf`;
}

export async function createDeckPdfResponse(
  deckId: string,
  dependencies: IDeckPdfDependencies,
): Promise<Response> {
  if (!z.uuid().safeParse(deckId).success) {
    return errorResponse("Invalid deck identifier.", 400);
  }

  let deck: TStoredDeck | null;
  try {
    deck = await dependencies.loadDeck(deckId);
  } catch (error) {
    logPdfError("load", error);
    return errorResponse("The deck could not be loaded.", 500);
  }
  if (!deck) return errorResponse("Generated deck not found.", 404);
  if (deck.slides.length === 0) {
    return errorResponse("The deck has no generated slides to export.", 422);
  }

  let html: string;
  try {
    html = renderDeckPdfHtml({
      title: deck.prompt,
      slides: deck.slides.map((entry) => entry.slide),
      tokens: deck.tokens,
    });
  } catch (error) {
    logPdfError("render", error);
    return errorResponse("The deck could not be prepared for export.", 500);
  }

  let browserResponse: Response;
  try {
    browserResponse = await dependencies.browser.quickAction("pdf", {
      html,
      addScriptTag: [{ content: FONT_READY_SCRIPT }],
      waitForSelector: {
        selector: "[data-pdf-ready]",
        timeout: 15_000,
      },
      viewport: { width: 1280, height: 720 },
      setJavaScriptEnabled: true,
      cacheTTL: 0,
      actionTimeout: PDF_TIMEOUT_MS,
      pdfOptions: {
        width: PDF_PAGE_SIZE.width,
        height: PDF_PAGE_SIZE.height,
        margin: { top: 0, right: 0, bottom: 0, left: 0 },
        displayHeaderFooter: false,
        preferCSSPageSize: true,
        printBackground: true,
        timeout: PDF_TIMEOUT_MS,
      },
    });
  } catch (error) {
    logPdfError("browser", error);
    return errorResponse("PDF generation is temporarily unavailable.", 502);
  }

  if (!browserResponse.ok) {
    logPdfError("browser", `Browser Run returned ${browserResponse.status}`);
    return errorResponse("PDF generation is temporarily unavailable.", 502);
  }

  return new Response(browserResponse.body, {
    headers: {
      "Cache-Control": "no-store",
      "Content-Disposition": `attachment; filename="${deckPdfFilename(deck.prompt, deck.id)}"`,
      "Content-Type": "application/pdf",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

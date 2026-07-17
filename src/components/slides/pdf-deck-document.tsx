import { renderToStaticMarkup } from "react-dom/server";

import type { CSSProperties } from "react";
import type { ISlide, ITokens } from "@/lib/slides/types";
import { SlideElementView } from "@/components/slides/slide-element";
import { googleFontsRequest } from "@/lib/slides/google-fonts";

const PDF_PAGE_WIDTH = 1280;
const PDF_PAGE_HEIGHT = 720;
const PDF_CANVAS_SCALE = 8 / 9;

export const PDF_PAGE_SIZE = {
  width: `${PDF_PAGE_WIDTH}px`,
  height: `${PDF_PAGE_HEIGHT}px`,
} as const;

const PRINT_CSS = `
@page { size: ${PDF_PAGE_SIZE.width} ${PDF_PAGE_SIZE.height}; margin: 0; }
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; background: #fff; }
.pdf-slide {
  position: relative;
  width: ${PDF_PAGE_SIZE.width};
  height: ${PDF_PAGE_SIZE.height};
  overflow: hidden;
  break-after: page;
  page-break-after: always;
  print-color-adjust: exact;
  -webkit-print-color-adjust: exact;
}
.pdf-slide:last-child { break-after: auto; page-break-after: auto; }
`;

function canvasStyle(tokens: ITokens): CSSProperties {
  return {
    position: "absolute",
    inset: 0,
    width: 1440,
    height: 810,
    transform: `scale(${PDF_CANVAS_SCALE})`,
    transformOrigin: "top left",
    overflow: "hidden",
    background: "var(--slide-white)",
    color: "var(--slide-text-dark)",
    fontFamily: "var(--slide-font-body)",
    "--slide-primary": tokens.colors.primary,
    "--slide-surface": tokens.colors.surface,
    "--slide-accent": tokens.colors.accent,
    "--slide-white": tokens.colors.white,
    "--slide-text-dark": tokens.colors.textDark,
    "--slide-text-muted": tokens.colors.textMuted,
    "--slide-font-display": tokens.fonts.display,
    "--slide-font-body": tokens.fonts.body,
  } as CSSProperties;
}

function PdfDeckDocument({
  title,
  slides,
  tokens,
}: {
  title: string;
  slides: Array<ISlide>;
  tokens: ITokens;
}) {
  const fonts = googleFontsRequest([tokens.fonts.display, tokens.fonts.body]);

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <title>{title}</title>
        {fonts && <link rel="stylesheet" href={fonts.href} />}
        <style>{PRINT_CSS}</style>
      </head>
      <body data-pdf-document>
        {slides.map((slide, index) => (
          <section
            key={slide.id}
            className="pdf-slide"
            data-pdf-slide={index + 1}
          >
            <div style={canvasStyle(tokens)}>
              {slide.elements.map((element) => (
                <SlideElementView key={element.id} element={element} />
              ))}
            </div>
          </section>
        ))}
      </body>
    </html>
  );
}

export function renderDeckPdfHtml({
  title,
  slides,
  tokens,
}: {
  title: string;
  slides: Array<ISlide>;
  tokens: ITokens;
}): string {
  if (slides.length === 0) {
    throw new Error("A PDF requires at least one generated slide.");
  }
  return `<!doctype html>${renderToStaticMarkup(
    <PdfDeckDocument title={title} slides={slides} tokens={tokens} />,
  )}`;
}

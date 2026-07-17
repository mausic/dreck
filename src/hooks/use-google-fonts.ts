import { useEffect, useState } from "react";

import type { IGoogleFontsRequest } from "@/lib/slides/google-fonts";
import { googleFontsRequest } from "@/lib/slides/google-fonts";

const FONT_LOAD_TIMEOUT_MS = 5_000;
const loadPromises = new Map<string, Promise<void>>();
const loadedStylesheets = new Set<string>();

function waitWithTimeout(promise: Promise<unknown>): Promise<void> {
  return new Promise((resolve) => {
    const timeout = window.setTimeout(resolve, FONT_LOAD_TIMEOUT_MS);
    void promise.then(
      () => {
        window.clearTimeout(timeout);
        resolve();
      },
      () => {
        window.clearTimeout(timeout);
        resolve();
      },
    );
  });
}

function loadStylesheet(request: IGoogleFontsRequest): Promise<void> {
  const current = loadPromises.get(request.href);
  if (current) return current;

  const promise = new Promise<boolean>((resolve) => {
    const link = document.createElement("link");
    const timeout = window.setTimeout(
      () => resolve(false),
      FONT_LOAD_TIMEOUT_MS,
    );
    link.rel = "stylesheet";
    link.href = request.href;
    link.onload = () => {
      window.clearTimeout(timeout);
      resolve(true);
    };
    link.onerror = () => {
      window.clearTimeout(timeout);
      resolve(false);
    };
    document.head.appendChild(link);
  })
    .then(async (stylesheetLoaded) => {
      if (!stylesheetLoaded) return;
      await waitWithTimeout(
        Promise.all(
          request.fonts.flatMap(({ family, weights }) =>
            weights.map((weight) =>
              document.fonts.load(`${weight} 16px "${family}"`),
            ),
          ),
        ),
      );
    })
    .then(() => {
      loadedStylesheets.add(request.href);
    });

  loadPromises.set(request.href, promise);
  return promise;
}

export function useGoogleFonts(displayFont: string, bodyFont: string): boolean {
  const request = googleFontsRequest([displayFont, bodyFont]);
  const href = request?.href ?? null;
  const [loadedHref, setLoadedHref] = useState<string | null>(null);

  useEffect(() => {
    const currentRequest = googleFontsRequest([displayFont, bodyFont]);
    if (!currentRequest) return;
    let active = true;
    void loadStylesheet(currentRequest).then(() => {
      if (active) setLoadedHref(currentRequest.href);
    });
    return () => {
      active = false;
    };
  }, [bodyFont, displayFont]);

  return href === null || loadedHref === href || loadedStylesheets.has(href);
}

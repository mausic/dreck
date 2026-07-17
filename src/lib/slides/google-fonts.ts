const GOOGLE_FONT_WEIGHTS = {
  "IBM Plex Sans": [400, 500, 600, 700],
  "Libre Franklin": [400, 500, 600, 700, 800],
} as const;

type TGoogleFontFamily = keyof typeof GOOGLE_FONT_WEIGHTS;

export interface IGoogleFontSpec {
  family: TGoogleFontFamily;
  weights: ReadonlyArray<number>;
}

export interface IGoogleFontsRequest {
  href: string;
  fonts: Array<IGoogleFontSpec>;
}

export function primaryFontFamily(fontStack: string): string | null {
  const first = fontStack.split(",", 1)[0]?.trim();
  if (!first) return null;
  const quoted = first.match(/^["'](.+)["']$/);
  return (quoted?.[1] ?? first).trim() || null;
}

function isGoogleFontFamily(family: string): family is TGoogleFontFamily {
  return family in GOOGLE_FONT_WEIGHTS;
}

export function googleFontsRequest(
  fontStacks: ReadonlyArray<string>,
): IGoogleFontsRequest | null {
  const families = new Set<TGoogleFontFamily>();
  for (const stack of fontStacks) {
    const family = primaryFontFamily(stack);
    if (family && isGoogleFontFamily(family)) families.add(family);
  }
  if (families.size === 0) return null;

  const fonts = Array.from(families).map((family) => ({
    family,
    weights: GOOGLE_FONT_WEIGHTS[family],
  }));
  const query = fonts
    .map(
      ({ family, weights }) =>
        `family=${encodeURIComponent(family).replaceAll("%20", "+")}:wght@${weights.join(";")}`,
    )
    .join("&");

  return {
    href: `https://fonts.googleapis.com/css2?${query}&display=swap`,
    fonts,
  };
}

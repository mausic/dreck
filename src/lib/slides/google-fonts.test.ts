import { describe, expect, it } from "vitest";

import {
  googleFontsRequest,
  primaryFontFamily,
} from "@/lib/slides/google-fonts";

describe("primaryFontFamily", () => {
  it("extracts the leading family from a CSS stack", () => {
    expect(
      primaryFontFamily(
        '"IBM Plex Sans", "Geist Variable", system-ui, sans-serif',
      ),
    ).toBe("IBM Plex Sans");
    expect(primaryFontFamily("Libre Franklin, sans-serif")).toBe(
      "Libre Franklin",
    );
  });
});

describe("googleFontsRequest", () => {
  it("builds one deduplicated request for supported extracted families", () => {
    const request = googleFontsRequest([
      '"Libre Franklin", sans-serif',
      '"IBM Plex Sans", sans-serif',
      '"IBM Plex Sans", system-ui',
    ]);

    expect(request?.fonts.map((font) => font.family)).toEqual([
      "Libre Franklin",
      "IBM Plex Sans",
    ]);
    expect(request?.href).toBe(
      "https://fonts.googleapis.com/css2?family=Libre+Franklin:wght@400;500;600;700;800&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap",
    );
  });

  it("uses the local fallback for unsupported families", () => {
    expect(googleFontsRequest(['"Aptos", system-ui'])).toBeNull();
  });
});

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { getConfig } from "@/lib/config";

const KEYS = [
  "DATABASE_URL",
  "GOOGLE_GENERATIVE_AI_API_KEY",
  "MISTRAL_API_KEY",
] as const;

beforeAll(() => {
  process.env.DATABASE_URL = "postgresql://neondb_owner:";
  process.env.GOOGLE_GENERATIVE_AI_API_KEY = "test-google-api-key";
  process.env.MISTRAL_API_KEY = "test-mistral-api-key";
});

afterAll(() => {
  for (const key of KEYS) delete process.env[key];
});

describe("config", () => {
  it("check empty environment", () => {
    const config = getConfig();
    expect(config.DATABASE_URL).toBe("postgresql://neondb_owner:");
    expect(config.GOOGLE_GENERATIVE_AI_API_KEY).toBe("test-google-api-key");
    expect(config.MISTRAL_API_KEY).toBe("test-mistral-api-key");
    expect(config.MISTRAL_OCR_MODEL).toBe("mistral-ocr-latest");
    expect(config.edit.EDIT_MODEL).toBe("gemini-3.5-flash");
    expect(config.design.DESIGN_MODEL).toBe("gemini-3.5-flash");
  });
});

import { afterEach, describe, expect, it } from "vitest";

import { getGenerationConfig } from "@/lib/config/generate-config";

const KEYS = [
  "GENERATE_CONCURRENCY",
  "GENERATE_FILL_RETRIES",
  "GENERATE_MODEL_RETRY_ATTEMPTS",
  "GENERATE_FIT_CHAR_RATIO",
] as const;

afterEach(() => {
  for (const key of KEYS) delete process.env[key];
});

describe("generationConfig", () => {
  it("falls back to defaults when unset", () => {
    const config = getGenerationConfig();
    expect(config.GENERATE_CONCURRENCY).toBe(5);
    expect(config.GENERATE_FILL_RETRIES).toBe(1);
    expect(config.GENERATE_MODEL_RETRY_ATTEMPTS).toBe(3);
    expect(config.GENERATE_FIT_CHAR_RATIO).toBeCloseTo(0.52);
  });

  it("reads valid overrides", () => {
    process.env.GENERATE_CONCURRENCY = "8";
    process.env.GENERATE_FIT_CHAR_RATIO = "0.6";
    const config = getGenerationConfig();
    expect(config.GENERATE_CONCURRENCY).toBe(8);
    expect(config.GENERATE_FIT_CHAR_RATIO).toBeCloseTo(0.6);
  });
});

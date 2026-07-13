import { afterEach, describe, expect, it } from "vitest";
import { generationConfig } from "@/lib/ai/config";

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
    const cfg = generationConfig();
    expect(cfg.GENERATE_CONCURRENCY).toBe(5);
    expect(cfg.GENERATE_FILL_RETRIES).toBe(1);
    expect(cfg.GENERATE_MODEL_RETRY_ATTEMPTS).toBe(3);
    expect(cfg.GENERATE_FIT_CHAR_RATIO).toBeCloseTo(0.52);
  });

  it("reads valid overrides", () => {
    process.env.GENERATE_CONCURRENCY = "8";
    process.env.GENERATE_FIT_CHAR_RATIO = "0.6";
    const cfg = generationConfig();
    expect(cfg.GENERATE_CONCURRENCY).toBe(8);
    expect(cfg.GENERATE_FIT_CHAR_RATIO).toBeCloseTo(0.6);
  });

  it("falls back to the default on an out-of-range value", () => {
    process.env.GENERATE_CONCURRENCY = "999";
    expect(generationConfig().GENERATE_CONCURRENCY).toBe(5);
    process.env.GENERATE_CONCURRENCY = "0";
    expect(generationConfig().GENERATE_CONCURRENCY).toBe(5);
  });

  it("falls back to the default when an integer knob gets a non-integer", () => {
    process.env.GENERATE_FILL_RETRIES = "2.9";
    expect(generationConfig().GENERATE_FILL_RETRIES).toBe(1);
  });

  it("falls back to the default on a non-numeric value", () => {
    process.env.GENERATE_CONCURRENCY = "not-a-number";
    expect(generationConfig().GENERATE_CONCURRENCY).toBe(5);
  });
});

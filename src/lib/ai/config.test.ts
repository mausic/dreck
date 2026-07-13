import { afterEach, describe, expect, it } from "vitest";
import {
  fillRetryBudget,
  fitCharWidthRatio,
  generationConcurrency,
  modelRetryAttempts,
} from "@/lib/ai/config";

const KEYS = [
  "GENERATE_CONCURRENCY",
  "GENERATE_FILL_RETRIES",
  "GENERATE_MODEL_RETRY_ATTEMPTS",
  "GENERATE_FIT_CHAR_RATIO",
];

afterEach(() => {
  for (const key of KEYS) delete process.env[key];
});

describe("generation config", () => {
  it("falls back to defaults when unset", () => {
    expect(generationConcurrency()).toBe(5);
    expect(fillRetryBudget()).toBe(1);
    expect(modelRetryAttempts()).toBe(3);
    expect(fitCharWidthRatio()).toBeCloseTo(0.52);
  });

  it("reads a valid override", () => {
    process.env.GENERATE_CONCURRENCY = "8";
    process.env.GENERATE_FIT_CHAR_RATIO = "0.6";
    expect(generationConcurrency()).toBe(8);
    expect(fitCharWidthRatio()).toBeCloseTo(0.6);
  });

  it("falls back to the default on an out-of-range value", () => {
    process.env.GENERATE_CONCURRENCY = "999";
    expect(generationConcurrency()).toBe(5);
    process.env.GENERATE_CONCURRENCY = "0";
    expect(generationConcurrency()).toBe(5);
  });

  it("falls back to the default when an integer knob gets a non-integer", () => {
    process.env.GENERATE_FILL_RETRIES = "2.9";
    expect(fillRetryBudget()).toBe(1);
  });

  it("ignores garbage and blank values, keeping the default", () => {
    process.env.GENERATE_CONCURRENCY = "not-a-number";
    expect(generationConcurrency()).toBe(5);
    process.env.GENERATE_CONCURRENCY = "   ";
    expect(generationConcurrency()).toBe(5);
  });
});

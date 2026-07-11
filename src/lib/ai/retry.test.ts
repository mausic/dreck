import { describe, expect, it, vi } from "vitest";
import {
  isFatalProviderError,
  isTransientProviderError,
  withModelRetry,
} from "@/lib/ai/retry";

/** Shapes mirroring the AI SDK's APICallError for the two classes we care about. */
const rateLimit = Object.assign(new Error("Too Many Requests"), {
  name: "AI_APICallError",
  statusCode: 429,
  isRetryable: true,
});
const overloaded = Object.assign(
  new Error("This model is currently experiencing high demand."),
  { name: "AI_APICallError", statusCode: 503, isRetryable: true },
);
const badKey = Object.assign(new Error("API key not valid"), {
  name: "AI_APICallError",
  statusCode: 403,
});

describe("provider error classification", () => {
  it("treats rate-limit/quota and auth as fatal, not transient", () => {
    expect(isFatalProviderError(rateLimit)).toBe(true);
    expect(isFatalProviderError(badKey)).toBe(true);
    expect(isTransientProviderError(rateLimit)).toBe(false);
    expect(isTransientProviderError(badKey)).toBe(false);
  });

  it("treats a 503 overload as transient, not fatal", () => {
    expect(isFatalProviderError(overloaded)).toBe(false);
    expect(isTransientProviderError(overloaded)).toBe(true);
  });

  it("does not treat an arbitrary error as transient", () => {
    expect(isTransientProviderError(new Error("boom"))).toBe(false);
  });
});

describe("withModelRetry", () => {
  it("returns immediately on success (no retry)", async () => {
    const run = vi.fn().mockResolvedValue("ok");
    await expect(withModelRetry(run)).resolves.toBe("ok");
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("retries a transient overload, then succeeds", async () => {
    const run = vi
      .fn()
      .mockRejectedValueOnce(overloaded)
      .mockResolvedValue("recovered");
    await expect(withModelRetry(run, 3)).resolves.toBe("recovered");
    expect(run).toHaveBeenCalledTimes(2);
  });

  it("does not retry a fatal rate-limit error", async () => {
    const run = vi.fn().mockRejectedValue(rateLimit);
    await expect(withModelRetry(run, 3)).rejects.toBe(rateLimit);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("gives up after maxAttempts on a persistent transient error", async () => {
    const run = vi.fn().mockRejectedValue(overloaded);
    await expect(withModelRetry(run, 2)).rejects.toBe(overloaded);
    expect(run).toHaveBeenCalledTimes(2);
  });
});

/**
 * Provider-error classification + a class-aware retry for the generation model calls.
 *
 * The AI SDK exposes only a single `maxRetries` number and, on a 429, honors the provider's
 * `Retry-After` (tens of seconds) — which on this interactive hot path reads as a hang. So the
 * plan/fill calls run with the SDK's own retry OFF (`maxRetries: 0`) and are wrapped in
 * {@link withModelRetry}, which retries by error CLASS:
 *   • transient overloads (503 UNAVAILABLE, network blips) → a few quick, capped backoffs;
 *   • fatal walls (rate-limit/quota, bad/absent key) → no retry, surface immediately.
 *
 * Attempt count and backoff bounds are env-tunable (see `config.ts`).
 */
import { getConfig } from "@/lib/config";

/** Text to test a provider error against (covers AI SDK wrappers like AI_RetryError). */
export function errorText(error: unknown): string {
  return error instanceof Error
    ? `${error.name} ${error.message}`
    : String(error);
}

/**
 * A provider error that will affect EVERY call the same way — a rate-limit/quota wall or a
 * bad/absent key. These do not recover within a request, so we never retry them and the
 * orchestrator aborts the deck with one clear message instead of failing each slide identically.
 */
export function isFatalProviderError(error: unknown): boolean {
  return /quota|rate.?limit|\b429\b|too many requests|resource_exhausted|unauthenticated|permission_denied|api[_ ]?key|\b401\b|\b403\b/i.test(
    errorText(error),
  );
}

/**
 * A transient provider error worth a quick retry: a server-side overload (503 UNAVAILABLE, 500)
 * or a network blip. Never treats a fatal wall as transient. Uses the SDK's `isRetryable` flag
 * when present, plus a text fallback for wrappers that don't carry it.
 */
export function isTransientProviderError(error: unknown): boolean {
  if (isFatalProviderError(error)) return false;
  const retryableFlag =
    typeof error === "object" &&
    error !== null &&
    (error as { isRetryable?: unknown }).isRetryable === true;
  return (
    retryableFlag ||
    /\b50[023]\b|unavailable|overloaded|high demand|econnreset|etimedout|fetch failed|network error/i.test(
      errorText(error),
    )
  );
}

/** A human-readable message for a fatal provider error, with the concrete way out. */
export function fatalProviderMessage(error: unknown): string {
  const text = errorText(error);
  if (
    /quota|\b429\b|resource_exhausted|too many requests|rate.?limit/i.test(text)
  ) {
    return "The generation model's rate limit / daily quota was reached. Wait for it to reset, use an API key with higher limits, or point GENERATE_MODEL at a different model.";
  }
  if (
    /unauthenticated|permission_denied|api[_ ]?key|\b401\b|\b403\b/i.test(text)
  ) {
    return "The generation model rejected the API key. Check GOOGLE_GENERATIVE_AI_API_KEY.";
  }
  return error instanceof Error ? error.message : "Generation failed.";
}

/**
 * Run a model call with class-aware retry. Retries only transient overloads, with a short, capped
 * exponential backoff (base doubling up to a cap) — never the provider's long rate-limit wait.
 * Fatal walls and non-transient errors throw on the first occurrence, so the caller can surface
 * them at once. The thunk MUST re-create the request each attempt (a consumed stream can't be
 * replayed). `maxAttempts` defaults to the env knob but can be overridden (e.g. in tests).
 */
export async function withModelRetry<TResult>(
  run: () => Promise<TResult>,
  maxAttempts?: number,
): Promise<TResult> {
  const generationConfig = getConfig().generation;
  const {
    GENERATE_MODEL_RETRY_ATTEMPTS,
    GENERATE_MODEL_RETRY_BASE_MS: baseMs,
    GENERATE_MODEL_RETRY_MAX_MS: maxMs,
  } = generationConfig;
  const attempts = maxAttempts ?? GENERATE_MODEL_RETRY_ATTEMPTS;
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await run();
    } catch (error) {
      lastError = error;
      if (attempt === attempts || !isTransientProviderError(error)) throw error;
      const delay = Math.min(baseMs * 2 ** (attempt - 1), maxMs);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw lastError;
}

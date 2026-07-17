import { getConfig } from "@/lib/config";

export function errorText(error: unknown): string {
  return error instanceof Error
    ? `${error.name} ${error.message}`
    : String(error);
}

export function isFatalProviderError(error: unknown): boolean {
  return /quota|rate.?limit|\b429\b|too many requests|resource_exhausted|unauthenticated|permission_denied|api[_ ]?key|\b401\b|\b403\b/i.test(
    errorText(error),
  );
}

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

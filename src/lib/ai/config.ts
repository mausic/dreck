/**
 * Tunable knobs for generation, read from the environment and validated with Zod (same as every
 * other parsed input in the app).
 *
 * These are FUNCTIONS, not module constants, and read `process.env` on each call — the same
 * discipline as the model getters (`model.ts`). On Cloudflare Workers `process.env` is only
 * reliably populated inside a request, so a module-level `const x = z.coerce.number().parse(...)`
 * would evaluate before the env exists and bake in the default.
 *
 * Each knob coerces the string, checks its bounds, and `.catch(fallback)`s to its default on ANY
 * failure — unset, blank, non-numeric, non-integer, or out of range — so a bad value can never
 * break or slow generation. Override in `.dev.vars` (dev) or Worker vars/secrets (prod).
 */
import { z } from "zod";

/** Normalize an env var to `string | undefined`, treating a blank/whitespace value as unset. */
function envRaw(name: string): string | undefined {
  const value = process.env[name];
  return value === undefined || value.trim() === "" ? undefined : value;
}

/** An integer knob in `[min, max]`; unset/blank/invalid/out-of-range all resolve to `fallback`. */
function intKnob(
  name: string,
  fallback: number,
  min: number,
  max: number,
): number {
  return z.coerce
    .number()
    .int()
    .min(min)
    .max(max)
    .catch(fallback)
    .parse(envRaw(name));
}

/** A real-valued knob in `[min, max]`; same fallback rules as {@link intKnob}. */
function floatKnob(
  name: string,
  fallback: number,
  min: number,
  max: number,
): number {
  return z.coerce
    .number()
    .min(min)
    .max(max)
    .catch(fallback)
    .parse(envRaw(name));
}

/** Max slide fills in flight at once (`GENERATE_CONCURRENCY`, default 5). */
export function generationConcurrency(): number {
  return intKnob("GENERATE_CONCURRENCY", 5, 1, 16);
}

/** Regenerate budget for an ungrounded/overflowing slide (`GENERATE_FILL_RETRIES`, default 1). */
export function fillRetryBudget(): number {
  return intKnob("GENERATE_FILL_RETRIES", 1, 0, 5);
}

/** Attempts for a transient model overload before giving up (`GENERATE_MODEL_RETRY_ATTEMPTS`, default 3). */
export function modelRetryAttempts(): number {
  return intKnob("GENERATE_MODEL_RETRY_ATTEMPTS", 3, 1, 6);
}

/** Base backoff for a transient retry, in ms (`GENERATE_MODEL_RETRY_BASE_MS`, default 500). */
export function modelRetryBaseMs(): number {
  return intKnob("GENERATE_MODEL_RETRY_BASE_MS", 500, 0, 60_000);
}

/** Cap on the transient-retry backoff, in ms (`GENERATE_MODEL_RETRY_MAX_MS`, default 2000). */
export function modelRetryMaxMs(): number {
  return intKnob("GENERATE_MODEL_RETRY_MAX_MS", 2000, 0, 120_000);
}

/** Estimated glyph advance ÷ font-size used by the fit estimator (`GENERATE_FIT_CHAR_RATIO`, default 0.52). */
export function fitCharWidthRatio(): number {
  return floatKnob("GENERATE_FIT_CHAR_RATIO", 0.52, 0.1, 2);
}

/** How much over the estimated line budget is tolerated before flagging overflow (`GENERATE_FIT_TOLERANCE`, default 1.15). */
export function fitTolerance(): number {
  return floatKnob("GENERATE_FIT_TOLERANCE", 1.15, 1, 3);
}

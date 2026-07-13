/**
 * Tunable knobs for generation, read from the environment.
 *
 * These are FUNCTIONS, not module constants, and read `process.env` on each call — the same
 * discipline as the model getters (`model.ts`). On Cloudflare Workers `process.env` is only
 * reliably populated inside a request, so a module-level `const x = Number(process.env.X)` would
 * silently bake in the default and the override would never take effect. Each knob falls back to a
 * sensible default when unset/unparseable and is clamped to a safe range, so a bad value can't
 * break generation. Override in `.dev.vars` (dev) or Worker vars/secrets (prod).
 */

interface IEnvNumberOptions {
  min?: number;
  max?: number;
  integer?: boolean;
}

/** Parse a numeric env var, falling back to `fallback` when unset/blank/unparseable, then clamp. */
function envNumber(
  name: string,
  fallback: number,
  { min, max, integer }: IEnvNumberOptions = {},
): number {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === "") return fallback;

  let value = Number(raw);
  if (!Number.isFinite(value)) return fallback;
  if (integer) value = Math.trunc(value);
  if (min !== undefined) value = Math.max(min, value);
  if (max !== undefined) value = Math.min(max, value);
  return value;
}

/** Max slide fills in flight at once (`GENERATE_CONCURRENCY`, default 5). */
export function generationConcurrency(): number {
  return envNumber("GENERATE_CONCURRENCY", 5, {
    min: 1,
    max: 16,
    integer: true,
  });
}

/** Regenerate budget for an ungrounded/overflowing slide (`GENERATE_FILL_RETRIES`, default 1). */
export function fillRetryBudget(): number {
  return envNumber("GENERATE_FILL_RETRIES", 1, {
    min: 0,
    max: 5,
    integer: true,
  });
}

/** Attempts for a transient model overload before giving up (`GENERATE_MODEL_RETRY_ATTEMPTS`, default 3). */
export function modelRetryAttempts(): number {
  return envNumber("GENERATE_MODEL_RETRY_ATTEMPTS", 3, {
    min: 1,
    max: 6,
    integer: true,
  });
}

/** Base backoff for a transient retry, in ms (`GENERATE_MODEL_RETRY_BASE_MS`, default 500). */
export function modelRetryBaseMs(): number {
  return envNumber("GENERATE_MODEL_RETRY_BASE_MS", 500, {
    min: 0,
    integer: true,
  });
}

/** Cap on the transient-retry backoff, in ms (`GENERATE_MODEL_RETRY_MAX_MS`, default 2000). */
export function modelRetryMaxMs(): number {
  return envNumber("GENERATE_MODEL_RETRY_MAX_MS", 2000, {
    min: 0,
    integer: true,
  });
}

/** Estimated glyph advance ÷ font-size used by the fit estimator (`GENERATE_FIT_CHAR_RATIO`, default 0.52). */
export function fitCharWidthRatio(): number {
  return envNumber("GENERATE_FIT_CHAR_RATIO", 0.52, { min: 0.1, max: 2 });
}

/** How much over the estimated line budget is tolerated before flagging overflow (`GENERATE_FIT_TOLERANCE`, default 1.15). */
export function fitTolerance(): number {
  return envNumber("GENERATE_FIT_TOLERANCE", 1.15, { min: 1, max: 3 });
}

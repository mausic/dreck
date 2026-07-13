/**
 * Tunable knobs for generation, declared as one Zod schema (like every other parsed input in the
 * app) and read from the environment.
 *
 * Read at REQUEST time via {@link generationConfig} — NOT as a module-level `const … =
 * schema.parse(process.env)`. On Cloudflare Workers `process.env` is only reliably populated inside
 * a request, so parsing at module load would capture an empty env and bake in the defaults (the
 * same reason the model getters read env on call).
 *
 * Every field `.catch()`es to its default, so a value that is unset, non-numeric, non-integer, or
 * out of range falls back to the default instead of throwing — a bad knob can never break or slow
 * generation. (`.default()` would only cover `undefined` and would throw on a bad value.) The field
 * names ARE the env var names. Override in `.dev.vars` (dev) or Worker vars/secrets (prod).
 */
import { z } from "zod";

const configSchema = z.object({
  /** Max slide fills in flight at once. */
  GENERATE_CONCURRENCY: z.coerce.number().int().min(1).max(16).catch(5),
  /** Regenerate budget per ungrounded/overflowing slide. */
  GENERATE_FILL_RETRIES: z.coerce.number().int().min(0).max(5).catch(1),
  /** Attempts on a transient model overload before giving up. */
  GENERATE_MODEL_RETRY_ATTEMPTS: z.coerce.number().int().min(1).max(6).catch(3),
  /** Base transient-retry backoff in ms (doubles each attempt). */
  GENERATE_MODEL_RETRY_BASE_MS: z.coerce
    .number()
    .int()
    .min(0)
    .max(60_000)
    .catch(500),
  /** Cap on the transient-retry backoff in ms. */
  GENERATE_MODEL_RETRY_MAX_MS: z.coerce
    .number()
    .int()
    .min(0)
    .max(120_000)
    .catch(2000),
  /** Glyph advance ÷ font-size used by the text-fit estimator. */
  GENERATE_FIT_CHAR_RATIO: z.coerce.number().min(0.1).max(2).catch(0.52),
  /** Overflow leniency before a slide is regenerated. */
  GENERATE_FIT_TOLERANCE: z.coerce.number().min(1).max(3).catch(1.15),
});

export type TGenerationConfig = z.infer<typeof configSchema>;

/** The validated generation config, read from the environment at call time (see module note). */
export function generationConfig(): TGenerationConfig {
  return configSchema.parse(process.env);
}

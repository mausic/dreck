import { z } from "zod";

export const generateConfigSchema = z.object({
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
  GENERATE_MODEL: z.string().optional().default("gemini-3.5-flash"),
});

export type TGenerationConfig = z.infer<typeof generateConfigSchema>;

export function getGenerationConfig(
  env: Record<string, unknown> = process.env,
): TGenerationConfig {
  return generateConfigSchema.parse(env);
}

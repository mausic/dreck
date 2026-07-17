import { z } from "zod";

export const generateConfigSchema = z.object({
  GENERATE_CONCURRENCY: z.coerce.number().int().min(1).max(16).catch(5),
  GENERATE_FILL_RETRIES: z.coerce.number().int().min(0).max(5).catch(1),
  GENERATE_MODEL_RETRY_ATTEMPTS: z.coerce.number().int().min(1).max(6).catch(3),
  GENERATE_MODEL_RETRY_BASE_MS: z.coerce
    .number()
    .int()
    .min(0)
    .max(60_000)
    .catch(500),
  GENERATE_MODEL_RETRY_MAX_MS: z.coerce
    .number()
    .int()
    .min(0)
    .max(120_000)
    .catch(2000),
  GENERATE_FIT_CHAR_RATIO: z.coerce.number().min(0.1).max(2).catch(0.52),
  GENERATE_FIT_TOLERANCE: z.coerce.number().min(1).max(3).catch(1.15),
  GENERATE_MODEL: z.string().optional().default("gemini-3.5-flash"),
});

export type TGenerationConfig = z.infer<typeof generateConfigSchema>;

export function getGenerationConfig(
  env: Record<string, unknown> = process.env,
): TGenerationConfig {
  return generateConfigSchema.parse(env);
}

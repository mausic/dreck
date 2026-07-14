import { z } from "zod";

import { generateConfigSchema } from "./generate-config";

const configSchema = z
  .object({
    DATABASE_URL: z.string().min(1, "Missing DATABASE_URL"),
    GOOGLE_GENERATIVE_AI_API_KEY: z
      .string()
      .min(1, "Missing GOOGLE_GENERATIVE_AI_API_KEY"),
    MISTRAL_API_KEY: z.string().min(1, "Missing MISTRAL_API_KEY"),
    MISTRAL_OCR_MODEL: z.string().optional().default("mistral-ocr-latest"),
    EDIT_MODEL: z.string().optional().default("gemini-3.5-flash"),
    DESIGN_MODEL: z.string().optional().default("gemini-3.5-flash"),
  })
  .passthrough()
  .transform(
    ({
      DATABASE_URL,
      GOOGLE_GENERATIVE_AI_API_KEY,
      MISTRAL_API_KEY,
      MISTRAL_OCR_MODEL,
      EDIT_MODEL,
      DESIGN_MODEL,
      ...env
    }) => ({
      DATABASE_URL,
      GOOGLE_GENERATIVE_AI_API_KEY,
      MISTRAL_API_KEY,
      MISTRAL_OCR_MODEL,
      edit: { EDIT_MODEL },
      design: { DESIGN_MODEL },
      generation: generateConfigSchema.parse(env),
    }),
  );

export type TConfig = z.infer<typeof configSchema>;

export function getConfig(env: Record<string, unknown> = process.env): TConfig {
  return configSchema.parse(env);
}

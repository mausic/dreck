/**
 * Resolves the language model for the edit call from the environment. Server-only: the
 * API key is read here and never leaves the Worker. This is the AI-SDK setup generation
 * will reuse — pick the provider here once, configure the model per-call via env.
 *
 * On Cloudflare Workers (nodejs_compat, compat date ≥ 2025-04-01) `process.env` is
 * populated from `wrangler.jsonc` `vars` and Worker secrets; in local `wrangler`/Vite dev
 * the same values come from `.dev.vars`. See `.dev.vars.example`.
 */
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import type { LanguageModel } from "ai";

/** Fast model on the hot path (edits are latency-sensitive); override with `EDIT_MODEL`. */
const DEFAULT_EDIT_MODEL = "gemini-3.5-flash";

/** Fast model for generation (planning + fill) too — speed-to-deck is a KPI. Override with `GENERATE_MODEL`. */
const DEFAULT_GENERATE_MODEL = "gemini-3.5-flash";

/** Thrown when the provider key is absent; the server function turns it into a soft error. */
export class MissingApiKeyError extends Error {
  constructor() {
    super("GOOGLE_GENERATIVE_AI_API_KEY is not set");
    this.name = "MissingApiKeyError";
  }
}

/** Build the edit model from env (`GOOGLE_GENERATIVE_AI_API_KEY`, `EDIT_MODEL`). */
export function getEditModel(): LanguageModel {
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!apiKey) throw new MissingApiKeyError();

  const modelId = process.env.EDIT_MODEL ?? DEFAULT_EDIT_MODEL;
  return createGoogleGenerativeAI({ apiKey })(modelId);
}

/** Build the generation model from env (`GOOGLE_GENERATIVE_AI_API_KEY`, `GENERATE_MODEL`). */
export function getGenerateModel(): LanguageModel {
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!apiKey) throw new MissingApiKeyError();

  const modelId = process.env.GENERATE_MODEL ?? DEFAULT_GENERATE_MODEL;
  return createGoogleGenerativeAI({ apiKey })(modelId);
}

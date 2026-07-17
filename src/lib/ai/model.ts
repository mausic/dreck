import { createGoogleGenerativeAI } from "@ai-sdk/google";
import type { LanguageModel } from "ai";
import { getConfig } from "@/lib/config";

export const MODEL_TIMEOUT_MS = 60_000;

export const getEditModel = (): LanguageModel => {
  const config = getConfig();
  return createGoogleGenerativeAI({
    apiKey: config.GOOGLE_GENERATIVE_AI_API_KEY,
  })(config.edit.EDIT_MODEL);
};

export const getGenerateModel = (): LanguageModel => {
  const config = getConfig();
  return createGoogleGenerativeAI({
    apiKey: config.GOOGLE_GENERATIVE_AI_API_KEY,
  })(config.generation.GENERATE_MODEL);
};

export const getDesignModel = (): LanguageModel => {
  const config = getConfig();
  return createGoogleGenerativeAI({
    apiKey: config.GOOGLE_GENERATIVE_AI_API_KEY,
  })(config.design.DESIGN_MODEL);
};

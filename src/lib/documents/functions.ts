import { createServerFn } from "@tanstack/react-start";

import { getDb } from "@/db/client";
import {
  listContentDocuments,
  listDesignDocuments,
} from "@/db/queries/documents.server";

function errorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Documents could not be loaded.";
}

export const listRecentContentDocs = createServerFn({ method: "GET" }).handler(
  async () => {
    try {
      return { ok: true as const, docs: await listContentDocuments(getDb()) };
    } catch (error) {
      return { ok: false as const, error: errorMessage(error) };
    }
  },
);

export const listRecentDesignDocs = createServerFn({ method: "GET" }).handler(
  async () => {
    try {
      return { ok: true as const, docs: await listDesignDocuments(getDb()) };
    } catch (error) {
      return { ok: false as const, error: errorMessage(error) };
    }
  },
);

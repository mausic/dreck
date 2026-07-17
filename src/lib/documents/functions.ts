import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { getDb } from "@/db/client";
import {
  deleteDesignDocumentRecord,
  listContentDocuments,
  listDesignDocuments,
} from "@/db/queries/documents.server";

const DeleteDesignDocumentInputSchema = z.object({ id: z.uuid() });

function errorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Documents could not be loaded.";
}

export async function deleteDesignDocumentResult(
  id: string,
  deleteRecord: (id: string) => Promise<boolean>,
) {
  try {
    const deleted = await deleteRecord(id);
    return deleted
      ? { ok: true as const, id }
      : { ok: false as const, error: "Extracted design not found." };
  } catch {
    return {
      ok: false as const,
      error: "The extracted design could not be deleted.",
    };
  }
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

export const deleteDesignDocument = createServerFn({ method: "POST" })
  .validator((input: unknown) => DeleteDesignDocumentInputSchema.parse(input))
  .handler(({ data }) =>
    deleteDesignDocumentResult(data.id, (id) =>
      deleteDesignDocumentRecord(getDb(), id),
    ),
  );

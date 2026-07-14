/**
 * Shared TanStack Query layer for the recent-document lists.
 *
 * Both the extract panel (its "existing document" pickers) and the generate panel (its
 * content/design source pickers) read these, so a single cache is the source of truth: fetched
 * once, kept in sync, and after an upload the extract panel invalidates the role's key so every
 * picker — in both panels — refreshes from the same cache.
 */
import { queryOptions } from "@tanstack/react-query";
import type { ITokens } from "@/lib/slides/types";
import {
  listRecentContentDocs,
  listRecentDesignDocs,
} from "@/lib/ai/generate-deck";

/**
 * A document as offered in a picker. Design docs also carry their cached design system, so a
 * selected design can be previewed without another round-trip.
 */
export type TDocOption = {
  id: string;
  sourceName: string;
  designTokens?: ITokens | null;
  designFeel?: string | null;
};

/** Stable query keys for the recent-document lists, keyed by role. */
export const documentsKeys = {
  all: ["documents"] as const,
  role: (role: "content" | "design") => ["documents", role] as const,
};

/** Recent content documents (newest first). Throws on a server failure so Query surfaces it. */
export function contentDocsQueryOptions() {
  return queryOptions({
    queryKey: documentsKeys.role("content"),
    queryFn: async () => {
      const res = await listRecentContentDocs();
      if (!res.ok) throw new Error(res.error);
      return res.docs;
    },
  });
}

/** Recent design documents (newest first), each with its cached tokens + feel for previewing. */
export function designDocsQueryOptions() {
  return queryOptions({
    queryKey: documentsKeys.role("design"),
    queryFn: async () => {
      const res = await listRecentDesignDocs();
      if (!res.ok) throw new Error(res.error);
      return res.docs;
    },
  });
}

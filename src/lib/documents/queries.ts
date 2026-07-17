import { queryOptions } from "@tanstack/react-query";
import type { IExtractedArchetype, ITokens } from "@/lib/slides/types";
import {
  listRecentContentDocs,
  listRecentDesignDocs,
} from "@/lib/documents/functions";

export type TDocOption = {
  id: string;
  sourceName: string;
  designTokens?: ITokens | null;
  designFeel?: string | null;
  designArchetypes?: Array<IExtractedArchetype> | null;
};

export const documentsKeys = {
  all: ["documents"] as const,
  role: (role: "content" | "design") => ["documents", role] as const,
};

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

/**
 * Drizzle client over the Neon serverless HTTP driver. HTTP (not TCP) is what makes this
 * work on Cloudflare Workers and in local `vite dev` alike — every query is a `fetch`, so
 * there are no sockets to keep alive. Server-only: `NEON_CONNECTION_STRING` is read here
 * from env (`.dev.vars` locally, a Worker secret in production) and never reaches the client.
 *
 * `getDb()` builds a fresh client per call — the HTTP driver is stateless and cheap, and a
 * Worker invocation is short-lived, so there's nothing to pool.
 */
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "@/db/schema";

/** Thrown when `NEON_CONNECTION_STRING` is absent; callers turn it into a soft error. */
export class MissingDatabaseUrlError extends Error {
  constructor() {
    super("NEON_CONNECTION_STRING is not set");
    this.name = "MissingDatabaseUrlError";
  }
}

/** Build a Drizzle client bound to the `documents` schema from `NEON_CONNECTION_STRING`. */
export function getDb() {
  const url = process.env.NEON_CONNECTION_STRING;
  if (!url) throw new MissingDatabaseUrlError();
  return drizzle(neon(url), { schema });
}

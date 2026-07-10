import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";

/** Thrown when `DATABASE_URL` is absent; callers turn it into a soft error. */
export class MissingDatabaseUrlError extends Error {
  constructor() {
    super("DATABASE_URL is not set");
    this.name = "MissingDatabaseUrlError";
  }
}

export function getDb() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new MissingDatabaseUrlError();
  return drizzle({ client: neon(url) });
}

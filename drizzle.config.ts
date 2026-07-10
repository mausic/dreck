/**
 * drizzle-kit config for schema migrations (`pnpm db:push` / `db:generate`).
 *
 * drizzle-kit runs in Node, not the Worker, so it reads `NEON_CONNECTION_STRING` from the
 * shell env (export it, or put it in a local `.env`) — the `.dev.vars` file is only read by
 * wrangler/Vite at runtime, not by this CLI.
 */
import { defineConfig } from "drizzle-kit";

const url = process.env.NEON_CONNECTION_STRING;
if (!url) {
  throw new Error("NEON_CONNECTION_STRING must be set to run drizzle-kit");
}

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url },
});

import { readFileSync } from "node:fs";
import { defineConfig } from "drizzle-kit";

function readDevDatabaseUrl(): string | undefined {
  try {
    const contents = readFileSync(
      new URL(".dev.vars", import.meta.url),
      "utf8",
    );
    const prefix = "DATABASE_URL=";
    const line = contents
      .split(/\r?\n/)
      .map((value) => value.trim())
      .find((value) => value.startsWith(prefix));
    if (!line) return undefined;
    const value = line.slice(prefix.length).trim();
    const quoted =
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"));
    return quoted ? value.slice(1, -1) : value;
  } catch {
    return undefined;
  }
}

// Wrangler uses .dev.vars locally; fall back to the process environment in CI/deploy tooling.
const databaseUrl = readDevDatabaseUrl() ?? process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("Missing DATABASE_URL");

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url: databaseUrl },
});

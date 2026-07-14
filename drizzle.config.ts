import { defineConfig } from "drizzle-kit";
import { getConfig } from "@/lib/config";

const config = getConfig();

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url: config.DATABASE_URL },
});

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { getConfig } from "@/lib/config";

export function getDb() {
  const config = getConfig();
  return drizzle({ client: neon(config.DATABASE_URL) });
}

import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Standalone from vite.config.ts on purpose: the app config loads the Cloudflare /
// TanStack Start plugins (a full Worker/SSR environment) which we don't want under the
// test runner. Component tests opt into jsdom at file level when they need a DOM.
const srcDir = fileURLToPath(new URL("./src", import.meta.url));

export default defineConfig({
  test: {
    env: {
      DATABASE_URL: "postgresql://neondb_owner:",
      GOOGLE_GENERATIVE_AI_API_KEY: "test-google-api-key",
      MISTRAL_API_KEY: "test-mistral-api-key",
    },
    environment: "node",
  },
  resolve: {
    // Regex forms so scoped packages like `@base-ui/react` are never rewritten —
    // only the `@/` and `#/` project prefixes map to ./src.
    alias: [
      { find: /^@\//, replacement: `${srcDir}/` },
      { find: /^#\//, replacement: `${srcDir}/` },
    ],
  },
});

import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Standalone from vite.config.ts on purpose: the app config loads the Cloudflare /
// TanStack Start plugins (a full Worker/SSR environment) which we don't want under the
// test runner. We only need path-alias resolution + a DOM for eventual component tests.
const srcDir = fileURLToPath(new URL("./src", import.meta.url));

export default defineConfig({
  test: {
    environment: "jsdom",
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

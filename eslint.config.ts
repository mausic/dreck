import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import pluginReact from "eslint-plugin-react";
import pluginReactHooks from "eslint-plugin-react-hooks";
import { defineConfig } from "eslint/config";
import eslintConfigPrettier from "eslint-config-prettier";
import { tanstackConfig } from "@tanstack/eslint-config";

/**
 * A custom ESLint configuration
 *
 * @type {import("eslint").Linter.Config[]}
 * */
export default defineConfig([
  {
    files: ["**/*.{js,mjs,cjs,ts,mts,cts,jsx,tsx}"],
    plugins: { js },
    extends: ["js/recommended"],
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
  },
  tseslint.configs.recommended,
  pluginReact.configs.flat.recommended,
  pluginReact.configs.flat["jsx-runtime"],
  {
    files: ["**/*.{ts,tsx}"],
    ...pluginReactHooks.configs.flat.recommended,
    settings: { react: { version: "19.2" } },
    rules: {
      ...pluginReactHooks.configs.flat.recommended.rules,
      // React scope no longer necessary with new JSX transform.
      "react/react-in-jsx-scope": "off",
    },
  },
  tanstackConfig,
  eslintConfigPrettier,
  {
    ignores: [
      "prettier.config.js",
      "commitlint.config.js",
      "worker-configuration.d.ts",
      "src/components/ui/**/*.tsx",
      "src/hooks/use-mobile.ts",
      "src/routeTree.gen.ts",
      ".tanstack",
      ".vscode",
      "node_modules",
      "dist",
      "public",
      ".wrangler",
    ],
  },
]);

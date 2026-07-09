# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

`dreck` is a single-user prototype: an **AI slide generator + region editor**. Upload a
reference PDF (content) + a design PDF (style) + a prompt → generate landscape slides →
preview → draw a rectangle on a slide → AI edits only that region.

The full product spec and architecture (generation flow, edit flow, slide model,
coordinate mapping, design-system extraction) lives in `docs/dreck-architecture.md` —
**read it before building any feature**, since most of the intended architecture is not
yet in code. The repo is currently close to the create-cloudflare / TanStack Start
starter (only `/` and `__root` routes exist).

## Commands

```bash
pnpm dev              # Vite dev server on port 3000
pnpm build            # production build
pnpm preview          # build + vite preview
pnpm test             # run Vitest once (vitest run)
pnpm test -- <file>   # run a single test file
pnpm lint             # eslint --fix over src/**/*.{ts,tsx}
pnpm format           # prettier --write .
pnpm deploy           # build + wrangler deploy to Cloudflare Workers
pnpm cf-typegen       # regenerate worker-configuration.d.ts from wrangler bindings
pnpm generate-routes  # manually regenerate src/routeTree.gen.ts (tsr generate)
```

Package manager is **pnpm** (do not use npm/yarn). Vitest uses jsdom + Testing Library;
there are no tests yet.

## Architecture

- **TanStack Start** (Router + Start) running on **Cloudflare Workers**. The Worker
  entry is `@tanstack/react-start/server-entry` (set in `wrangler.jsonc`), and the app
  is bundled by Vite via `@cloudflare/vite-plugin` (`ssr` environment). Server logic is
  expected to use TanStack **server functions** (`createServerFn`) — e.g. the planned
  `generate` and `edit` operations — rather than a separate API layer.
- **File-based routing.** Routes are files in `src/routes/`; `src/routes/__root.tsx` is
  the shell/layout. `src/routeTree.gen.ts` is **auto-generated** by the router plugin on
  dev/build — never edit it by hand (it is git-tracked but eslint-ignored).
- **`src/router.tsx`** builds the router (`getRouter`) with `defaultPreload: "intent"`
  and augments the `@tanstack/react-router` `Register` interface for typed routing.
- **UI**: React 19 + **shadcn/ui** (style `base-nova`, base color `stone`, Tabler icons)
  - **Tailwind CSS v4** (configured via the Vite plugin; global CSS in `src/styles.css`).
    Generated shadcn components land in `src/components/ui/` (eslint-ignored). Use the
    `cn()` helper from `@/lib/utils` for class merging.
- **Cloudflare bindings** (KV, D1, R2, Durable Objects, vars) are declared in
  `wrangler.jsonc`; after changing them run `pnpm cf-typegen` to refresh types.

## Conventions

- **Path aliases**: both `#/*` and `@/*` map to `./src/*` (`@/*` is the shadcn
  convention used in components). Import types explicitly, e.g.
  `import { type Foo } from "@/lib/bar"` (`verbatimModuleSyntax` is on).
- **Commits must be Conventional Commits** — enforced by commitlint via the Husky
  `commit-msg` hook. The Husky `pre-commit` hook runs `lint-staged` (prettier + eslint
  on staged files), so formatting/lint issues block commits.
- TypeScript is `strict` with `noUnusedLocals`/`noUnusedParameters` and
  `noUncheckedSideEffectImports`; `noEmit` (Vite/esbuild handles transpilation).

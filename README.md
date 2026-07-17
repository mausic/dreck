# Dreck

Dreck is a single-user prototype for generating and region-editing slide decks with AI.
It accepts a content PDF, an optional design PDF, and a brief; produces grounded slide
JSON; renders it in a canonical 16:9 canvas; and persists revision-checked region edits.

The product decisions and complete generation/edit flows are documented in
[`docs/dreck-architecture.md`](docs/dreck-architecture.md).

## Stack

- TanStack Start and React 19
- Cloudflare Workers and Browser Rendering
- Drizzle ORM with PostgreSQL on Neon
- AI SDK with Google models and Mistral OCR
- Tailwind CSS and shadcn/ui
- Vitest and Testing Library

## Development

Install dependencies, copy the documented variables into `.dev.vars`, and apply the
checked-in database migration before starting the app.

```bash
pnpm install
cp .dev.vars.example .dev.vars
pnpm db:migrate
pnpm dev
```

The application runs at `http://localhost:3000`.

PDF uploads are limited to 15 MB. Design PDFs are limited to 12 pages; each page is
isolated before layout extraction so the full deck is not resent for every archetype.

Generated decks can be downloaded as PDFs from their detail page. In local development,
the `BROWSER` binding runs remotely against the authenticated Cloudflare account, so run
`pnpm exec wrangler login` before testing PDF downloads. Each export consumes Browser
Rendering usage; the generated response is streamed directly and is not cached.

## Commands

```bash
pnpm dev             # generate Worker types and start Vite
pnpm build           # production Worker build
pnpm test            # run all tests once
pnpm lint            # lint application TypeScript
pnpm typecheck       # run TypeScript without emitting
pnpm format:check    # verify formatting
pnpm db:generate     # generate a migration from src/db/schema.ts
pnpm db:migrate      # apply checked-in migrations
pnpm db:push         # push the schema to a development database
pnpm db:studio       # open Drizzle Studio
```

## Structure

```text
src/
  components/        UI composition and slide canvas
  db/
    schema.ts        SQL schema and inferred row types
    queries/         server-only, runtime-validated Drizzle operations
  hooks/             client workflow state machines
  lib/
    ai/
      *.ts           shared model, retry, grounding, fit, and concurrency utilities
    documents/       document server functions and query options
    edit/            region-edit contracts, prompts, and server function
    generate/        deck planning, filling, contracts, and orchestration
    extract/         content and design-system extraction
    slides/          pure slide domain, schemas, geometry, rendering contracts
  routes/            TanStack file routes
drizzle/             generated, versioned SQL migrations
```

The important dependency direction is UI to server functions to orchestration to database
queries/providers. Shared slide modules remain runtime-neutral and are validated at AI and
database boundaries.

## Persistence

`documents` stores extracted content or design systems. `decks` records the source documents,
prompt, plan, design snapshot, lifecycle status, and generation counts. `slides` stores the
canonical slide JSON, grounding report, stable logical ID, order, and edit revision.

## Deployment Security

The Worker configuration disables both `workers.dev` and preview URLs. Before deploying
the custom hostname, create a Cloudflare Access self-hosted application for
`dreck.ryndia.me` and add an Allow policy for the intended user. Access applications deny
unmatched requests by default and check every request before it reaches the paid AI server
functions.

See Cloudflare's
[self-hosted application guide](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/self-hosted-public-app/)
for the dashboard setup. Store `GOOGLE_GENERATIVE_AI_API_KEY`, `MISTRAL_API_KEY`, and
`DATABASE_URL` as Worker secrets before running `pnpm deploy`.

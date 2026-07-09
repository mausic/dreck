---
name: typescript-code-styles
description: Use when implementing TypeScript code in the repo. This skill enforces the repo's non-negotiable TypeScript code style rules, including file naming, interface/type naming, and type import syntax. It also provides guidance on when to use `interface` vs `type`. Invoke this skill whenever writing or reviewing TypeScript code in the repo.
---

## Coding style — non-negotiable

1. **File naming: kebab-case**. All new files use lowercase words separated by hyphens. Examples: `trade-balance.ts`, `trade-balance.test.ts`, `osv-header-parser.ts`. Single-word filenames are fine (`header.ts`). Test files mirror the source: `<name>.test.ts`. Fixture-driven smoke tests use `<name>.smoke.test.ts`. Do not rename existing files just to conform — only enforce on new files and on files you are already touching for other reasons.

2. **Interfaces are `I`-prefixed**: `interface IUser`, `interface IOsvRow`, `interface IParseResult`. Use `interface` when the shape is extendable or describes an object contract; use `type` for unions, intersections, mapped types, primitives, and tuples.

3. **Type aliases are `T`-prefixed**: `type TUserId = string`, `type TParseStatus = "ok" | "warn" | "error"`. Generic parameters keep the conventional single-letter form (`T`, `K`, `V`) — the `T` prefix rule applies to named type aliases, not to generics.

4. **Type imports always use `import { type X }` form**:

   ```ts
   import { type IOsvRow, type TParseStatus } from "@idris/domain";
   ```

   This is enforced by ESLint and is also a global user preference. Never use `import type { ... }` (the alternate form) in this repo — keep imports consistent with the inline-`type` style.

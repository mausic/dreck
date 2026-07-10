---
name: typescript-code-styles
description: Use when implementing TypeScript code in the repo. This skill enforces the repo's non-negotiable TypeScript code style rules — file naming, interface/type naming, generic-parameter naming, array syntax, and type-import syntax — mirrored from the ESLint config (`@tanstack/eslint-config`). It also provides guidance on when to use `interface` vs `type`. Invoke this skill whenever writing or reviewing TypeScript code in the repo.
---

## Coding style — non-negotiable

These mirror the repo's ESLint config (`@tanstack/eslint-config`, wired up in
`eslint.config.js`). Rules tagged **[eslint]** are machine-enforced — auto-fixable ones
are rewritten on staged files by the Husky `lint-staged` pre-commit hook, so write them
correctly up front to avoid noisy re-formatting; type-aware ones (naming, unnecessary
conditions) are **not** auto-fixable and will block the commit until fixed. Rules tagged
**[convention]** are repo conventions ESLint does not check — follow them anyway.

1. **File naming: kebab-case** — **[convention]**. All new files use lowercase words separated by hyphens. Examples: `trade-balance.ts`, `trade-balance.test.ts`, `osv-header-parser.ts`. Single-word filenames are fine (`header.ts`). Test files mirror the source: `<name>.test.ts`. Fixture-driven smoke tests use `<name>.smoke.test.ts`. Do not rename existing files just to conform — only enforce on new files and on files you are already touching for other reasons.

2. **Interfaces are `I`-prefixed** — **[convention]**: `interface IUser`, `interface IOsvRow`, `interface IParseResult`. Use `interface` when the shape is extendable or describes an object contract; use `type` for unions, intersections, mapped types, primitives, and tuples.

3. **Named type aliases are `T`-prefixed** — **[convention]**: `type TUserId = string`, `type TParseStatus = "ok" | "warn" | "error"`. This applies to named aliases, not to generic parameters (rule 4).

4. **Generic type parameters: `T` or `TPascalCase`** — **[eslint]** (`@typescript-eslint/naming-convention`). A type parameter must match `^(T|T[A-Z][A-Za-z]+)$` — exactly `T`, or `T` followed by a PascalCase word: `TData`, `TKey`, `TValue`, `TError`. Single letters like `K`, `V`, `U`, `E` are **not** allowed — use `TKey`, `TValue`, etc. Leading/trailing underscores are forbidden.

5. **Type imports use a dedicated top-level `import type { … }` statement** — **[eslint]** (`@typescript-eslint/consistent-type-imports` with `prefer: "type-imports"`, and `import/consistent-type-specifier-style: "prefer-top-level"`). Inline type markers (`import { type X }`) are **banned** in this repo and auto-rewritten by the pre-commit hook.

   ```ts
   // ✅ type-only import
   import type { IUser, TUserId } from "packageName";

   // ✅ need a value AND a type from the same module → two statements
   import { userFeature } from "packageName";
   import type { IUser } from "packageName";

   // ❌ inline type markers — will be rewritten on commit
   import { userFeature, type IUser } from "packageName";
   ```

   > This **overrides** the global user preference for inline `import { type X }`. That preference applies in repos without this ESLint rule; **in this repo, top-level `import type` wins** because the pre-commit hook enforces it. Don't re-litigate it per file.

6. **Arrays use the generic form `Array<T>` / `ReadonlyArray<T>`** — **[eslint]** (`@typescript-eslint/array-type: "generic"`), never `T[]` or `readonly T[]`. e.g. `slots: Array<ISlot>`, not `slots: ISlot[]`.

## Other ESLint rules worth knowing

Not core "style", but they fail the build/commit — write to them up front:

- **No unnecessary conditions** (`@typescript-eslint/no-unnecessary-condition`): don't guard a value the type says can't be nullish (e.g. `x !== null` when `x` is never `null`). Narrow only what the types actually allow. _(not auto-fixable — blocks commit)_
- **Property-style method signatures** (`@typescript-eslint/method-signature-style: "property"`): write `onChange: (v: string) => void`, not `onChange(v: string): void`.
- **`as const` over literal-type annotations** (`@typescript-eslint/prefer-as-const`).
- **`node:` protocol for builtins** (`node/prefer-node-protocol`): `import { readFile } from "node:fs/promises"`.
- **Import order** (`import/order`, `import/newline-after-import`, `import/no-duplicates`): builtin → external → internal → parent → sibling → index → object → type, a blank line after the import block, no duplicate sources.
- **`@ts-expect-error` (with a description), never `@ts-ignore`** (`@typescript-eslint/ban-ts-comment`).
- **No inferrable type annotations** (`@typescript-eslint/no-inferrable-types`, parameters exempt): drop `: number` on `const n: number = 5`.

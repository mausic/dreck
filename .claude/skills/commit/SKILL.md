---
name: commit
description: Use when the user asks to commit changes in the repo — phrases like "commit", "commit this", "let's commit", "ok commit", "commit the staged changes", or any instruction to create a git commit. Encapsulates the project's full commit workflow — scope selection from commitlint.config.js (always re-read it), modular staging, message format, no Claude attribution, never-push-without-asking, and recovery from pre-commit hook failures. Invoke this skill BEFORE running `git commit` so the rules are loaded.
---

# Commit skill

The single source of truth for how commits are made in this repo. When the user asks to commit, follow this skill end-to-end. Do not improvise commit messages, scopes, or trailers from memory — re-read `commitlint.config.js` each time the scope set might be relevant.

## 0. Pre-flight: never assume

Before doing anything else:

1. Run `git status` and `git diff --stat` (in parallel) to see what's actually pending.
2. Run `git log -5 --oneline` to match recent message style.
3. If `commitlint.config.js` has been touched recently OR you're not 100% sure of the scope to use, **re-read `commitlint.config.js`** — the scope list grows over time and your memory may be stale.

Only commit when the user has explicitly asked. If the user said something ambiguous like "save this" or "looks good", confirm first.

## 1. Stage deliberately

- **Never `git add -A` or `git add .`** — those sweep up untracked files (`.env`, machine-local configs, in-progress experiments) the user did not intend to commit.
- Stage by explicit path. If multiple unrelated changes are pending, **propose splitting into multiple commits** rather than bundling.
- Skip files that look like secrets (`.env*`, `credentials*`, `*.pem`, `*.key`) unless the user explicitly named them.
- Watch out for these commonly-untracked-but-machine-local items in this repo:
  - `.claude/settings.local.json` — user-specific permissions/attribution; do **not** stage.
  - `packages/parser/fixtures/private/` — gitignored client data; do **not** stage.
  - `node_modules`, `dist`, `.turbo`, `.cache`, `coverage`, `*.log`, `*.tsbuildinfo`, `*.env`, `.DS_Store` — already in `.gitignore`, but double-check.

## 2. Pick the type and scope

**Type** comes from `commitlint.config.js` `type-enum`. Common picks:

| Type       | When                                                                  |
| ---------- | --------------------------------------------------------------------- |
| `feat`     | A new user-visible capability                                         |
| `fix`      | A bug fix (something was broken; this restores correct behavior)      |
| `refactor` | Behavior-preserving code change                                       |
| `perf`     | Measurable performance improvement                                    |
| `test`     | Test-only change (adding, fixing, or restructuring tests)             |
| `docs`     | Documentation only — including JSDoc, README, CLAUDE.md, agent files  |
| `chore`    | Tooling/automation that isn't code, build, or CI                      |
| `build`    | Build system or external deps (turbo, tsconfig, package.json scripts) |
| `cicd`     | CI configuration                                                      |
| `config`   | Project configuration files (commitlint, eslint, prettier configs)    |
| `deps`     | Dependency bumps                                                      |
| `style`    | Whitespace, formatting (no behavior change)                           |
| `security` | Security fix                                                          |
| `revert`   | Reverts a previous commit                                             |

**Scope** comes from `commitlint.config.js` `scope-enum`. Re-read it. Currently allowed scopes (as of last read — verify):

- Per-package: `parser`, `engine`, `excel`, `storage`, `domain`, `db`, `emails`
- Apps: `web`, `api`, `worker`
- Umbrella: `packages` (use **only** when a change spans multiple packages)
- Meta: `workspace`, `setup`, `deps`, `config`, `scripts`, `docs`, `lint`, `cicd`, `release`, `deploy`, `blog`

**Rules:**

- **Prefer the most specific scope.** A parser-only change is `fix(parser): …`, not `fix(packages): …`. Use `packages` only when the diff genuinely spans `parser` + `engine` + `excel` etc.
- App vs. package: changes inside `apps/api/**` use `api`, not `packages`.
- Repo-root config (`package.json`, `turbo.json`, `tsconfig.base.json`, `commitlint.config.js`, root `eslint.config.mjs`) usually wants `workspace` or `config`.
- `.claude/**` (agents, skills, settings) is `workspace` — it's tooling for the whole repo.
- Documentation edits including CLAUDE.md, READMEs, and JSDoc-only updates are `docs(<scope>)`.

## 3. Write the message

**Format:**

```
<type>(<scope>): <subject>

<body — optional, wraps at ~72 chars, explains WHY>

<footer — optional: BREAKING CHANGE, refs Linear issue>
```

**Subject line:**

- Imperative mood ("add", "fix", "extend"), not past tense ("added", "fixed").
- Lowercase first word, no trailing period.
- ≤72 characters.
- Describes WHAT changed at a glance.

**Body (when used):**

- Wrap at ~72 chars.
- Explain WHY, not WHAT (the diff already shows what).
- Mention surprising decisions, trade-offs, follow-ups.
- For multi-bullet bodies, use `-` bullets.

**Footer:**

- Reference the Linear issue if applicable: `Refs IDR-29` or `Closes IDR-29`.
- `BREAKING CHANGE: <description>` for API breaks (rare in this repo right now).

**Trailers — DO NOT add:**

- ❌ `Co-Authored-By: Claude …`
- ❌ `Generated with Claude Code`
- ❌ Any Claude/Anthropic attribution

The user has set `attribution.commit` and `attribution.pr` to empty in `.claude/settings.local.json` precisely to suppress these. Settings always win over CLAUDE.md or older instructions.

## 4. Run the commit

**Always use HEREDOC for multi-line messages** — this preserves newlines and avoids shell-quoting hell:

```bash
git commit -m "$(cat <<'EOF'
fix(parser): tighten counterparty-sum tolerance from 0.5 to 0.01

The 0.5 UAH tolerance was masking a real diagnostic on YuKA fixture #3
where two rows summed to 0.41 short of the parent. Tighter bound surfaces
the issue without false positives on the rest of the gold set.
EOF
)"
```

For one-line commits, the simple form is fine:

```bash
git commit -m "docs(parser): clarify trade-balance anchor split"
```

## 5. Recover from a hook failure

The pre-commit hook runs `lint-staged` (prettier + eslint on staged files).

**If it fails:**

1. Read the error. Fix the underlying issue in the file.
2. Re-stage the fixed file (`git add <path>`).
3. Create a **NEW** commit (`git commit -m …`) — do **NOT** `git commit --amend`. The previous commit never landed; amending would modify whatever's at `HEAD` (an unrelated earlier commit), potentially destroying it.
4. Never `--no-verify` to bypass the hook unless the user explicitly asked. If a hook is broken, fix the hook.

**If lint auto-fixed something:** lint-staged stages the fix automatically; the commit proceeds. No action needed.

## 6. After committing

1. Run `git log -1 --format="%h %s"` to confirm the commit landed and report the short SHA + subject to the user.
2. **Never push.** The user controls push and PR cadence. If they want to push, they will say so.
3. If there are remaining unstaged or untracked changes from before this commit, mention them in your reply so the user knows nothing slipped through — but don't stage or commit them without being asked.

## 7. Splitting changes into multiple commits

If the staged diff covers multiple unrelated concerns (e.g., a bug fix AND a doc update AND a refactor), **propose splitting** before committing. Example:

> The pending changes look like three separate concerns:
>
> 1. `fix(parser): handle null counterparty cell` — `header.ts`, `header.test.ts`
> 2. `docs(parser): document trade-balance anchor split` — `README.md`
> 3. `refactor(engine): extract sign-normalisation helper` — `engine/normalise.ts`
>
> Want me to commit them separately?

Wait for confirmation before splitting. If the user says "just commit it", bundle and pick the most representative type/scope.

## 8. Examples (real commits from this repo)

```
docs(packages): clarify trade-balance anchor split + cover digit-prefix regression
refactor(packages): tighten counterparty-sum tolerance from 0.5 to 0.01
config(workspace): extend commilint scope
docs(packages): backfill diagnostic table entries for IDR-27/28
docs(packages): document trade balance extractor
chore(workspace): add backend-engineer agent for TS backend + packages work
docs(workspace): refresh CLAUDE.md commit-scope guidance
```

Note that several historical commits use `packages` where today the more specific `parser` would be preferred — that scope was added later. Going forward, prefer the specific scope.

## Quick checklist

Before running `git commit`, mentally verify:

- [ ] User asked to commit (not assumed).
- [ ] `git status` and `git diff` reviewed.
- [ ] No secrets, no `.local.*`, no fixtures/private data in the staged set.
- [ ] Type is in `commitlint.config.js` `type-enum`.
- [ ] Scope is in `commitlint.config.js` `scope-enum` AND is the most specific that fits.
- [ ] Subject is imperative, lowercase, ≤72 chars, no trailing period.
- [ ] No `Co-Authored-By` or Claude attribution anywhere in the message.
- [ ] HEREDOC used for any multi-line message.
- [ ] Will report the resulting SHA back to the user; will not push.

---
name: pr
description: Push the current branch and create a pull request on GitHub against the repo template. Triggers — explicit `/pr`, or natural-language phrasing like "open a PR", "create a pull request", "let's PR this", "ship the PR for TASK-ID-29". Generates PR title + body from the commit history, links the Linear issue automatically when detectable from the branch name (`*/task-id-XX-*`) or commits, and follows `.github/PULL_REQUEST_TEMPLATE.md`. ALWAYS surfaces the draft PR for user approval BEFORE pushing or creating, and never adds Claude attribution to the PR body.
argument-hint: "[--base=main] [--linear=TASK-ID-XX] [--draft] [custom PR title]"
user_invocable: true
---

# pr skill

Push the current branch and create a well-structured pull request on the GitHub repo.

The PR body strictly follows `.github/PULL_REQUEST_TEMPLATE.md` (sections: Features, Fixes, Infrastructure, CI/CD, Docs, Chores, Breaking Changes, Screenshots, Pre-merge Checklist, Related Issues). Empty sections are removed; populated sections keep their emoji.

## Step 1 — Parse arguments

Extract from `$ARGUMENTS`:

- `--base=<branch>` — target branch (default: `main`).
- `--linear=<issue-id>` — Linear issue to link, e.g. `TASK-ID-29`. Overrides auto-detection.
- `--draft` — create as a draft PR.
- Any remaining text becomes a custom PR title.

$ARGUMENTS

## Step 2 — Validate state

Run these checks; abort with a clear message on failure:

- **Current branch must NOT be `main`.** If on main, abort: "Cannot create a PR from the base branch."
- **No uncommitted changes.** If staged or unstaged changes exist, suggest invoking the `commit` skill first and stop. Do not silently include them.
- **Branch must have commits ahead of base.** Run `git log <base>..HEAD --oneline`. If empty, abort: "No changes to create a PR for."
- **gh must be authenticated.** A quick `gh auth status` will surface auth issues before we get to PR creation.

## Step 3 — Gather context (parallel)

Run these in parallel via the Bash tool:

- `git log <base>..HEAD --oneline` — list of commits.
- `git diff <base>...HEAD --stat` — files-changed summary (note the **three** dots — diff vs the merge base).
- `git log <base>..HEAD --format='%s%n%n%b%n---'` — full subjects + bodies for grouping into PR sections.
- `git rev-parse --abbrev-ref HEAD` — current branch (used to detect `task-id-XX` and to push).

## Step 4 — Auto-detect Linear issue

If `--linear` was not provided, try in order:

1. **Branch name** matches `*/task-id-(\d+)-*` (case-insensitive). Linear's `gitBranchName` follows `<user>/task-id-<n>-<slug>`. Convert to `TASK-ID-<n>`.
2. **Commit subjects/bodies** mention `TASK-ID-<n>`. If multiple, prefer the one referenced in `Refs TASK-ID-XX` / `Closes TASK-ID-XX` lines; otherwise the first.
3. If still unknown, leave Related Issues empty — do not invent a link.

If found, fetch the issue via `mcp__linear-server-__get_issue { id: "TASK-ID-XX" }` to use the title as the PR title fallback and to know the issue state.

## Step 5 — Generate PR content

### Title (first that applies)

1. Custom title from `$ARGUMENTS`.
2. `[TASK-ID-XX]: <Linear issue title>` if Linear was detected.
3. Conventional-commit format from the dominant commit: `<type>(<scope>): <subject>`. Under 72 chars.
   - Types and scopes come from `commitlint.config.js` — re-read it if the scope is unclear. Common picks: `feat(parser): …`, `fix(engine): …`, `refactor(api): …`, `chore(workspace): …`, `docs(packages): …`.
   - Prefer the most specific scope (`parser` over `packages` for parser-only changes).

### Body — fill the template

Open `.github/PULL_REQUEST_TEMPLATE.md` and produce a body that **strictly conforms** to its section order and emojis. Rules:

1. **Group by TYPE, not by package.** Do NOT use `### packages/parser` / `### packages/engine` headings. Prefix bullets with the file path or package when useful: `**packages/parser/src/trade-balance.ts** — added trade-balance extractor with fixture-gated tests`.
2. **Remove empty sections** entirely. Pre-merge Checklist is always required; Related Issues is required when a Linear issue was detected; Screenshots only when there are UI changes.
3. **Keep emoji prefixes.** Every kept section retains its emoji.
4. **Map commit types to sections:**
   - `feat` → ✨ Features
   - `fix` → 🐛 Fixes
   - `docs` → 📝 Docs
   - `refactor`, `chore`, `style`, `perf`, `deps`, `test` → 🧹 Chores (test work goes here unless the PR is mostly tests, then call out as a Fix or Feat as appropriate)
   - `build`, `config`, `security` → 🏗️ Infrastructure
   - `cicd` → 🔄 CI/CD
5. **Each bullet:** bold lead phrase + dash + explanation. No sub-bullets. Order by importance.
6. **Related Issues:** use Linear magic words with the issue ID:
   - `Fixes TASK-ID-XX` — for bug fixes (`fix` commits dominant).
   - `Closes TASK-ID-XX` — for completed feature work (`feat` commits dominant).
   - `Resolves TASK-ID-XX` — generic / mixed.
     Remove the section entirely if no Linear issue was detected.
7. **Pre-merge Checklist:** concrete, actionable boxes. Each item describes the action AND the expected result. Tailor by what the PR touches — see "Conditional checklist items" below.
8. **Breaking Changes:** only include for API breaks, removed/renamed exports from `packages/domain`, changed env vars, or destructive DB migrations. Remove section entirely if none.
9. **Never add `Co-Authored-By: Claude …`** or any Anthropic/Claude attribution. The user's `.claude/settings.local.json` sets `attribution.pr = ""` precisely to suppress this — settings always win.

## Step 6 — Present PR draft and wait for approval

Show the user:

```
## Pull Request Preview

**Repo**: mausic/dreck
**Title**: <title>
**Base**: <base> ← <current-branch>
**Commits**: <N> commits, <M> files changed
**Linear**: <TASK-ID-XX or "none detected">
**Draft**: <yes/no>

<full PR body>

Create this pull request?
```

**Wait for explicit approval.** The user may approve, request edits, or cancel. Do NOT proceed until they confirm. Edits should be applied in place and the preview re-shown.

## Step 7 — Push branch

If the local branch has commits not yet on the remote:

```bash
git push -u origin <current-branch>
```

**Ask for explicit confirmation before pushing.** This is the first network-side action and is much harder to undo than local commits. Even in auto mode, do not push without an explicit "yes / push it / go".

If the branch is already on the remote and up to date, skip this step. If the local branch is behind the remote, surface the divergence and stop — let the user decide whether to rebase or pull first.

## Step 8 — Create the pull request

```bash
gh pr create \
  --repo mausic/dreck \
  --title "<title>" \
  --base <base> \
  --body "$(cat <<'EOF'
<full PR body>
EOF
)"
```

Add `--draft` if `--draft` was passed.

After creation:

1. Capture the PR URL from `gh pr create` output.
2. Surface to the user with: PR URL, the auto-detected Linear link, and the title.
3. **Do NOT auto-merge, auto-comment, or auto-request reviewers** unless the user explicitly asked.

## Step 9 — Linear sync (optional, only if /linear flow already moved it)

- Post a Linear comment with the PR URL via `mcp__linear-server__save_comment`.

If the work was ad-hoc (not through `/linear`), skip this step — the user will manage Linear themselves.

## Rules

- **Never push to `main`.** Abort if current branch is `main`.
- **Always confirm PR content** before creating. Show the full draft.
- **Always confirm push** before running `git push`. This is a shared-state action.
- **Concise is better than complete.** PR body should be informative but not regurgitate the diff. Bullet point per meaningful change; let reviewers click through for details.
- **Conventional Commits scope rules apply to the PR title** — re-check `commitlint.config.cjs` if the scope is unclear, and prefer the most specific scope.

## When NOT to use

- The branch is `main` (no PR possible).
- The user wants to commit, not PR — invoke the `commit` skill instead.
- The user wants to update an existing PR's description — that's a `gh pr edit` operation, not this skill.
- The user wants to merge a PR — explicit `gh pr merge` invocation, not this skill.

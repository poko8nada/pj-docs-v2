---
name: implement
description: >-
  Build the agreed unit (slice / chore scope / design surface) using coding rules in references/.
  Phase skills Read this SKILL.md first (permission handshake), then run this skill to edit code.
---

# implement

Build exactly the unit the caller already agreed with the user. The plan (or chore scope) is source of truth — do not reopen settled questions, do not expand scope.

**Read this file before editing product/harness code** — that Read is the permission handshake required by work phase skills (and by the gate when enabled). In `discussion`, `implement` is `null` (not applicable); reading this file there does not unlock code.

## What you own

- Coding how/rules via `references/` (read what applies; do not dump them in chat)
- Implementing the agreed unit
- Batch verify + confirm message (changed files)

## What you do not own

- Phase entry, mode ①/②, or plan writing — phase skill + `forge`/`refine`/`design` references
- Issue create/update / slice checkboxes — `issue` via the caller after confirm
- Feasibility research — `feasibility`
- Expanding into the next slice unless the user explicitly agreed that scope

## When called

| Caller                    | Unit                                                              |
| ------------------------- | ----------------------------------------------------------------- |
| `forge` / `refine` Mode ② | **One** vertical slice from the issue plan                        |
| `design`                  | Thinking-surface work per `design/references` (hardcoded data OK) |
| `chore`                   | The exact tiny scope already agreed                               |
| `spec`                    | Exceptional only — still keep scope minimal                       |

If agreement or unit is unclear, stop and return to the caller — do not invent scope.

## Step 1 — Read rules

Read the reference files relevant to the task. Internalize — do not summarize in chat.

- TypeScript: `references/typescript.md`
- CSS / Tailwind: `references/css.md`
- Testing: `references/testing.md`
- Markdown: `references/markdown.md`

## Step 2 — Build

Build what the plan’s **File changes** (or the agreed chore/design scope) specifies. Not a stub — correct structure, behavior, and edge cases the unit requires.

Keep the dev environment usable so the user can verify at any point.

## Step 3 — Verify

Run verification as a **single batch** after changes — not per-file. Prefer this repo’s scripts when present:

```bash
pnpm typecheck && pnpm lint && pnpm format:check && pnpm test:run
```

If a script is missing, run what exists and note the gap in confirm. Follow Test policy from the plan when a slice marks `N/A`.

## Step 4 — Confirm

List concrete changes: files, functions, components created or modified. Note any deviation from the plan (only if the user already approved that deviation).

Return to the caller so they can update the issue / ask for the next slice.

## Step 5 — NOTE comments (if present)

If changed files contain pending `NOTE:` lines, check whether this unit resolved them:

```bash
rg -n 'NOTE:' <changed files>
```

- Still relevant → leave the line
- Resolved by this unit → delete the `NOTE:` line after user confirms (see `notes` skill)
- Uncertain → mention in confirm

## Step 6 — Before commit

After `git add`, before `git commit`:

1. Run **`notes` skill — Commit check** (`.cursor/skills/notes/scripts/list-removed.mjs`). Do not commit until the user OKs any removed NOTE lines.
2. Run **`/pre-commit-reviewer`** on the current `review.files` batch. Harness blocks `git commit` while `review.status` is `pending`. Launching the reviewer sets `reviewed` and clears `files` (PASS/GAPS are not read by the harness). If you re-edit afterward (including GAPS fixes), status returns to `pending` — review that new batch before commit.

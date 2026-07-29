---
name: rules
description: >-
  Edit rules via references/ (logic, components, documents, and more).
  Run this skill before gated edits, then execute at least one matching reference.
---

# rules

Edit only the agreed scope. Do not reopen settled questions or expand scope.

**Run this skill before gated edits** — that opens `unlock.rules` (the harness detects the skill file Read).
In `discussion`, running this skill does not unlock edits.

## 1 — Execute matching references

Pick **at least one** file under `references/` before editing. Apply its guidance. The harness records the file Read — choose what fits the change. Internalize; do not summarize in chat.

| File            | When (examples)                                                              |
| --------------- | ---------------------------------------------------------------------------- |
| `documents.md`  | `.md` / `.mdc` body shape (issue/README content → those skills)              |
| `logic.md`      | Pure functions, domain logic, `Result`                                       |
| `components.md` | UI, Tailwind/CSS, a11y                                                       |
| `html.md`       | Document markup / website HTML manners                                       |
| `state.md`      | Client state, `use*`                                                         |
| `api.md`        | HTTP / fetch boundaries                                                      |
| `data.md`       | Objects, JSON, persistence / schema thinking                                 |
| `shared.md`     | Cross-cutting (imports, exports, comments, test manners) — default if unsure |

Examples: README typo → `documents`. New `useX` → `state`. Button styles → `components`. Page landmarks / semantic markup → `html`. Unit test file → `shared`. Pure helper → `logic`. Object/JSON/schema shape → `data`. Unsure → `shared`.

Phase re-entry clears progress — run this skill and needed references again.

## 2 — Edit

Apply the agreed changes. Not a stub — correct structure and edge cases the unit requires. Keep the environment usable so the user can verify.

## 3 — Tests

Do **not** manually run `pnpm format` / `lint` / `typecheck` (or `format:check`). The harness already does that:

- agent `stop` (and leftover flush on `beforeSubmitPrompt`): format + lint on edited `*.{js,jsx,ts,tsx,mjs,cjs}`; `typecheck:staged` on `*.{ts,tsx}`
- lefthook pre-commit: same split

If the stop hook reports failures via `followup_message`, fix those — do not re-run the whole batch yourself up front.

When tests apply, run as a single batch after changes:

```bash
pnpm test:run
```

If the script is missing, note the gap in confirm. When tests are `N/A`, skip.

## 4 — Confirm

List concrete changes: files, functions, components created or modified. Note any deviation only if the user already approved it.

## 5 — NOTE comments (if present)

If changed files contain pending `NOTE:` lines:

```bash
rg -n 'NOTE:' <changed files>
```

- Still relevant → leave the line
- Resolved by this unit → delete after user confirms (see `notes` skill)
- Uncertain → mention in confirm

## 6 — Before commit

When the harness shows files pending pre-commit review:

1. Run **`notes` skill — Commit check** (`.cursor/skills/notes/scripts/list-removed.mjs`). Do not commit until the user OKs any removed NOTE lines.
2. Run **`/pre-commit-reviewer`**. The hook injects each `review.files` path with `git diff HEAD` (or full content if new/untracked), then clears `files`. The reviewer focuses on that injection (readonly; no git). `git add` order does not matter. Harness blocks `git commit` only while `review.files` is non-empty. Re-edits refill `files`. Only reviewer launch or a successful commit clears `files` (empty commit attempts do not).

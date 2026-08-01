---
name: rules
description: >-
  Apply edit guidance via references/ (logic, components, documents, …).
  Use before gated file edits. Reading this file opens unlock.rules.
---

# rules

Apply matching references, then edit. Reading this file opens `unlock.rules`.

## Steps

1. Read **at least one** `references/*` that matches the change. Apply it. Do not summarize in chat.

| File            | When                                   |
| --------------- | -------------------------------------- |
| `documents.md`  | `.md` / `.mdc` body shape              |
| `logic.md`      | Pure functions, domain logic, `Result` |
| `components.md` | UI, Tailwind/CSS, a11y                 |
| `html.md`       | Document markup                        |
| `state.md`      | Client state, `use*`                   |
| `api.md`        | HTTP / fetch boundaries                |
| `data.md`       | Objects, JSON, persistence / schema    |
| `shared.md`     | Cross-cutting / default if unsure      |

2. Edit — correct structure and edges for the unit. Keep the environment usable.
3. Tests — do **not** run `pnpm format` / `lint` / `typecheck` yourself (harness stop + lefthook). On stop `followup_message`, fix those. When tests apply: `pnpm test:run` once after changes; if missing, note in confirm; `N/A` → skip.
4. Confirm — list concrete files / symbols changed.
5. If pending `NOTE:` in changed files: `rg -n 'NOTE:' …` — keep, or delete after user OK (`notes`), or mention if unsure.
6. Before commit if the current reviewable Git snapshot is not bound to a PASS: `notes` Commit check → `/pre-commit-reviewer`.
   - `REVIEW: PASS` → stop or `git commit` (clears via harness).
   - `REVIEW: GAPS` → show the user. If items match **already agreed** tradeoffs, confirm that exclusion, then re-invoke the reviewer with those items listed as user-accepted (review the rest only). Do not invent PASS. Unagreed gaps → fix or re-agree before another review.

Phase re-entry clears progress — run this skill and refs again.

## Limits

- Edit only the agreed scope. Do not reopen settled questions or expand scope.
- Do not re-run the whole format/lint batch up front.

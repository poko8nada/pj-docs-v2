---
name: rules
description: >-
  Apply edit guidance via references/ (logic, components, documents, …).
  Use before gated file edits. Reading this file opens unlock.rules.
---

# rules

Choose references by semantic responsibility, not by filename extension. Read the matching references, then edit. Reading this file opens `unlock.rules`.

## Steps

1. Identify the responsibilities touched by the change and read every matching `references/*`. Apply them. Do not summarize in chat.

| Reference        | Responsibility                         |
| ---------------- | -------------------------------------- |
| `documents.md`   | Document prose and structure           |
| `logic.md`       | Pure functions, domain logic, `Result` |
| `components.md`  | UI composition and presentation        |
| `markup.md`      | Semantic web markup                    |
| `ui-state.md`    | UI interaction state                   |
| `api.md`         | HTTP / fetch boundaries                |
| `data.md`        | Objects, JSON, persistence, schema     |
| `conventions.md` | Cross-cutting conventions              |

## Combining references

Read more than one reference when a change crosses responsibilities:

- A form component: `components` + `markup` + `ui-state`
- An API-backed feature: `api` + `logic` + `data`
- A persisted UI flow: `components` + `ui-state` + `logic` + `data`
- Placement, naming, or test conventions: `conventions` plus the primary responsibility

2. Edit — correct structure and edges for the unit. Keep the environment usable.
3. Tests — do **not** run `pnpm format` / `lint` / `typecheck` yourself (harness stop + lefthook). On stop `followup_message`, fix those. When tests apply: `pnpm test:run` once after changes; if missing, note in confirm; `N/A` → skip.
4. Confirm — list concrete files / symbols changed.
5. If pending `NOTE:` in changed files: `rg -n 'NOTE:' …` — keep, or delete after user OK (`notes`), or mention if unsure.
6. Before commit if the current reviewable Git snapshot is not bound to a PASS: `notes` Commit check → `/pre-commit-reviewer`.
   - `REVIEW: PASS` → stop binds the matching snapshot; successful `git commit` clears it via the harness.
   - `REVIEW: GAPS` → show the user. If items match **already agreed** tradeoffs, confirm that exclusion, then re-invoke the reviewer with those items listed as user-accepted (review the rest only). Do not invent PASS. Unagreed gaps → fix or re-agree before another review.

Phase re-entry clears progress — run this skill and refs again.

## Limits

- Edit only the agreed scope. Do not reopen settled questions or expand scope.
- Do not re-run the whole format/lint batch up front.

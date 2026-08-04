---
name: rules
description: >-
  Applies responsibility-specific edit guidance so agreed changes follow project conventions. Use before gated file edits to select and read matching `references/*`. Do not use for session direction, agenda planning, or read-only inspection; reading it opens unlock.rules but does not replace scope or user agreement.
---

# rules

Choose references by semantic responsibility, not by filename extension. Read the matching references, then edit. Reading this file opens `unlock.rules`.

## Produces

- Applicable reference guidance, recorded reads, and `unlock.rules=true` in a work phase.

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

Phase re-entry clears progress — run this skill and refs again.

## Limits

- Edit only the agreed scope. Do not reopen settled questions or expand scope.
- Do not re-run the whole format/lint batch up front.

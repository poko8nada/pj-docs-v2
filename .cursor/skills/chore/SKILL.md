---
name: chore
description: >-
  Non-product harness, meta, tooling, documentation, and non-functional product-adjacent maintenance work, such as typos, copy, formatting, or behavior-preserving cleanup. Use when the user invokes /chore.
  For a bounded concern with multiple steps, optionally use the chore agenda.
  Not for Goal/Discover/Build (/work) or session direction (discussion).
disable-model-invocation: true
---

# chore

One bounded maintenance concern; it may touch product files, be large, and span multiple slices. No product behavior, capability, or contract change.
No Goal / Discover / Build track.

## Steps

1. If `unlock.scope` is not true, do not start the chore or run `scope` from this phase. Name `/discussion` and wait for the user to confirm the focus with `/scope ok`. State the touch list. Re-dump Theme only if boundaries shifted.
2. Unclear ask → name `/discussion` and agree Theme / In / Out via `scope` before editing. Vague “fix stuff” → stop.
3. If the bounded concern needs multiple steps or choices, read `agenda` and `agenda/references/chore.md`; otherwise skip it. Stop for user agreement before editing.
4. A behavior, capability, user-interaction, data/API contract, or Goal/Discover/Build change is product work → name `/work` (or `/discussion`). Scope creep → stop, restate the touch list, or name `/discussion`.
5. Before edits → `rules` + matching `rules/references/*`.
6. Issues only if asked → `issue`.

Edits need user-confirmed `unlock.scope` then `unlock.rules`. Chore agenda planning does not open `unlock.agenda`.

## Limits

- One coherent concern per sitting; use the agenda when it has multiple slices.
- Do not grow Discover/Build product work here.

Hand off: `scope` / `agenda` / `issue` / `rules`.

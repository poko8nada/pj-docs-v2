---
name: chore
description: >-
  Performs non-product harness, meta, tooling, documentation, and behavior-preserving maintenance so the repository stays usable without changing product behavior, capability, or contracts. Use when the user invokes `/chore`; optionally use the chore agenda for multi-step concerns. Do not use for Goal / Discover / Build product work (`/work`) or session direction (`discussion`); unlock.scope gates edits, not phase handoff.
disable-model-invocation: true
---

# chore

One bounded maintenance concern; it may touch product files, be large, and span multiple slices. No product behavior, capability, or contract change.
No Goal / Discover / Build track.

## Steps

1. If `unlock.scope` is not true, keep actions read-only and do not run `scope` from this phase. Name `/discussion` if the focus needs confirmation. State the touch list. Re-dump Theme only if boundaries shifted.
2. Unclear ask → name `/discussion` and agree Theme / In / Out via `scope` before editing. Vague “fix stuff” → stop.
3. If the bounded concern needs multiple steps or choices, read `agenda` and `agenda/references/chore.md`; otherwise skip it. Stop for user agreement before editing.
4. A behavior, capability, user-interaction, data/API contract, or Goal/Discover/Build change is product work → name `/work` (or `/discussion`). Scope creep → stop, restate the touch list, or name `/discussion`.
5. Before edits → `rules` + matching `rules/references/*`.
6. Issues only if asked → `issue`.

Edits need `unlock.scope` then `unlock.rules`. Chore agenda planning does not open `unlock.agenda`.

## Produces

- A bounded maintenance outcome with its concrete validation or documented `N/A` reason.

## Handoff

- `discussion` / `scope` when focus or boundaries need confirmation.
- `agenda` for multi-step chores, `rules` before edits, and `issue` only when explicitly requested.

## Limits

- One coherent concern per sitting; use the agenda when it has multiple slices.
- Do not grow Discover/Build product work here.

---
name: discussion
description: >-
  Default phase and return hatch from hands-on. Agree session focus then run scope.
  Use when starting a conversation, stepping back from hands-on, or when focus must be re-agreed.
  `/discussion` clears unlock.scope.
disable-model-invocation: true
---

# discussion

Agree this session’s focus, then run `scope`. Prose alone does not open `unlock.scope`.

## Steps

1. Read open `[Goal]` / `[Discover]` / `[Build]`, soft comments (`## soft: …`), cited `findings/`, and product code when Build-stage.
2. Respond. No plan issue — synthesize from evidence.
3. On **change intent**: agree Theme (In / Out if needed) → same turn Read `scope` + set-label when stable. Format → `scope`.
4. Keep talking on that focus, or let the user invoke `/work` / `/chore`. Do not stop only to wait for `/work`. Do not self-invoke phases.

Judgment heuristics → `references/judgment.md` (read when orientation is hard).

## Limits

- No file edits. No mutating `gh`/`git`. No issue create/update.
- Do not run `rules` for edits. Do not inventory→slice — that is `agenda`.
- Do not treat prose Theme as a substitute for reading `scope`.
- Do not copy other skill bodies — hand off by name.

Hand off: `scope` / `agenda`.

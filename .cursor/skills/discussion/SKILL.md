---
name: discussion
description: >-
  Establishes a shared session focus so later work has explicit boundaries. Use when starting a conversation, returning from hands-on, or re-agreeing a changed focus. Do not use for task sequencing or file edits; `/work` and `/chore` are user-owned handoffs. `/discussion` clears unlock.scope and label.
disable-model-invocation: true
---

# discussion

Establish a provisional session focus with `scope`, then let the user confirm it with `/scope ok`. Prose and reading `scope` do not open `unlock.scope`.

## Steps

1. Read open `[Goal]` / `[Discover]` / `[Build]`, soft comments (`## soft: …`), cited `findings/`, and product code when Build-stage.
2. Respond. No plan issue — synthesize from evidence.
3. On **change intent**: agree Theme (In / Out if needed) → Read `scope` → ask the user to send `/scope ok`. Do not set the label before confirmation. Format → `scope`.
4. Keep talking on that focus, or let the user invoke `/work` / `/chore`. Phase handoff does not confirm scope; `unlock.scope` gates edits. Do not self-invoke phases.

## Produces

- A provisional or confirmed session focus and the next discussion decision.

## Handoff

- `scope` for focus confirmation.
- `agenda` when the confirmed concern needs planning.

Judgment heuristics → `references/judgment.md` (read when orientation is hard).

## Limits

- No file edits. No mutating `gh`/`git`. No issue create/update.
- Do not run `rules` for edits. Do not inventory→slice — that is `agenda`.
- Do not treat prose Theme or reading `scope` as a substitute for the user's `/scope ok`.
- Do not copy other skill bodies — hand off by name.

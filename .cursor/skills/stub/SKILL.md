---
name: stub
description: >-
  One-turn code scaffold while /mentor is on. Harness no-op if mentor is off.
  User-only — agents must not self-invoke.
disable-model-invocation: true
---

# stub

Unlocks code edits for the agent response that contains `/stub` only. Prefer signatures / stubs / TODOs unless the user asks for more that turn. Next prompt clears the unlock.

## Steps

1. Mentor on → write minimal scaffold for this turn. Caller still runs `rules` / refs / review as usual.
2. Mentor off → no-op; use `/mentor` first if mentoring is intended.
3. Not an exit from mentor — leave with `/mentor off`.

## Limits

- Agents must not invoke `/stub`.

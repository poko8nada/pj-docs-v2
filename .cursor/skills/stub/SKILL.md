---
name: stub
description: >-
  One-turn code scaffold while /mentor is on. Harness no-op if mentor is off.
  User-only — do not self-invoke.
disable-model-invocation: true
---

# stub

**User-only.** Under `/mentor`, ask the agent to **write code for this one turn** — usually a scaffold (signatures, stubs, TODOs) so the human can fill the rest. Normal phase / `unlock.rules` / refs / review still apply.

Not an exit from mentor. Leave mentor with `/mentor off`.

## When mentor is on

The prompt that contains `/stub` unlocks code edits for that agent response only. Prefer minimal structure over a full implementation unless the user asks for more in the same turn. The next user prompt clears the unlock.

## When mentor is off

**Harness no-op** — does not unlock anything. Mentoring is not active; use normal Agent flow (or `/mentor` first).

## Hard limits

- **Agents must not** invoke `/stub` on their own.

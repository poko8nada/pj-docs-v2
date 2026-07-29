---
name: bootstrap
description: >-
  Emergency gate bypass when the harness is broken and normal /chore → rules skill cannot unlock edits.
  User-only — do not self-invoke.
disable-model-invocation: true
---

# bootstrap

**User-only rescue.** When the gate is broken (e.g. phase/unlock out of sync, or `lib/gate-core.mjs` throws), normal work phases cannot unlock code edits. `/bootstrap` turns on a temporary bypass so harness files can be fixed.

`gate.mjs` is a thin entry: if the core fails to load or run while bootstrap is on, the entry still returns allow. Keep the entry and `lib/bootstrap.mjs` healthy — those are the life raft.

Does **not** change phase or unlock progress. Creates `.cursor/hooks/.bootstrap` only.

## On

User sends `/bootstrap` in the prompt. Gate allows edits and shell until turned off.

## Off

| Method           | Action                               |
| ---------------- | ------------------------------------ |
| `/bootstrap off` | Removes the marker immediately       |
| CLI session ends | `sessionEnd` hook removes the marker |
| Terminal         | `rm .cursor/hooks/.bootstrap`        |

Turn off after the harness is fixed. Do not leave bootstrap on for normal work.

## Hard limits

- **Agents must not** invoke `/bootstrap` or `/bootstrap off` on their own.
- Do not use for product features — use `/chore` (or other work phases) when the gate works.
- Marker file is hooks-only; do not create or delete it via Write/Shell.

---
name: bootstrap
description: >-
  Emergency gate bypass when the harness is broken. User sends /bootstrap; /bootstrap off clears it.
  User-only — agents must not self-invoke.
disable-model-invocation: true
---

# bootstrap

Temporary bypass via `.cursor/hooks/.bootstrap`. Does not change phase or unlock progress.

## Steps

| Command          | Action                        |
| ---------------- | ----------------------------- |
| `/bootstrap`     | Marker on — edits/shell allow |
| `/bootstrap off` | Marker off                    |
| session end      | `sessionEnd` removes marker   |
| Terminal         | `rm .cursor/hooks/.bootstrap` |

Turn off after the harness is fixed.

## Limits

- Agents must not invoke `/bootstrap` or `/bootstrap off`.
- Not for product features when the normal gate works — use `/chore` then.
- Do not create/delete the marker via Write/Shell.

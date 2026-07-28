---
name: label
description: >-
  Set a short label on this conversation's gate state so humans can tell sessions apart.
  Run when the session topic is settled or changes. User or agent may request it; the agent runs the script.
---

# label

Put a short slug on the current conversation state (`label` field). Helps when reading `.cursor/hooks/state/*` files (ids alone are hard to recognize).

## When

- Discussion Flow step **Label** — once **Theme** is stable (required before handing off to another phase)
- Theme becomes clear earlier (optional, same script)
- Topic changes enough that the old label is misleading

## How (agent runs this)

```bash
node .cursor/skills/label/scripts/set-label.mjs <label>
```

- `<label>`: 1–64 chars, letters / digits / `.` `_` `-` only (e.g. `review-gate`)
- Conversation id comes from `CURSOR_CONVERSATION_ID` in the agent Shell (do not pass id by hand)
- Updates `.cursor/hooks/state/*__<id>.json` `label` field only (does not import hooks modules)
- Allowed in any phase (including `discussion`)

## Smoke

```bash
node .cursor/skills/label/scripts/set-label.smoke.mjs
```

## User

Ask the agent to set a label, or say the desired slug; the agent runs the script above.

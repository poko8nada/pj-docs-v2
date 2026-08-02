---
name: scope
description: >-
  Proposes and confirms a session Theme / In / Out so discussion and later edits share explicit boundaries. Use when a focus is new, unclear, changing, or not yet user-confirmed. Do not use for task sequencing or file edits; only the user’s `/scope ok` opens unlock.scope. Close: `/discussion`.
---

# scope

Make the session focus explicit so discussion can continue in a shared direction.
Only the user's `/scope ok` confirms the focus and opens `unlock.scope`; reading this file or agreeing in prose does not do so.

## Steps

1. Agree a provisional Theme (add In / Out when boundaries matter). Theme alone is enough when clear.
2. On reject: revise (do not repeat the same block). One clarifying question at most. Wrong Theme → rewrite Theme first; wrong boundaries → fix In / Out. Topic change → re-agree and update the label only after the next `/scope ok`.
3. When Theme is stable, ask the user to send `/scope ok`. Do not set the label or treat the focus as confirmed before that command.
4. After the user sends `/scope ok`, set the label:

```bash
node .cursor/skills/scope/scripts/set-label.mjs <label>
```

- 1–64 chars: letters / digits / `.` `_` `-` only
- Id from `CURSOR_CONVERSATION_ID` (do not pass by hand)
- Skip while Theme is fuzzy
- Smoke: `node .cursor/skills/scope/scripts/set-label.smoke.mjs`

5. Same Theme continuing → do not re-dump every turn. Continue discussion after confirmation when more decisions are needed. Close is `/discussion` only; it clears `unlock.scope` and `label`.

## Produces

- A Theme with optional In / Out boundaries; after user confirmation, `unlock.scope=true` and the session label.

## Handoff

- `discussion` while the focus is being refined.
- User-owned `/work` or `/chore` after the focus is confirmed.

## Format

```markdown
**Theme:** {one line — session thread}

**In scope:**

- …

**Out of scope:**

- …
```

| Field        | Write                           | Do not write                 |
| ------------ | ------------------------------- | ---------------------------- |
| Theme        | One-line umbrella for this beat | Issue body dump, file lists  |
| In scope     | 1–3 bullets — treat now         | Slice table, implement steps |
| Out of scope | 1–3 bullets — exclude now       | Straw men nobody asked for   |

Good: Theme = Goal covenant; In = who/outcome; Out = stack/screens/MVP list.  
Bad: Theme = Build the todo app; In = Next.js + DnD + auth; Out empty.

## Limits

- Prose agreement and reading this file do not open the gate — only the user's `/scope ok` does.
- The agent must not send or simulate `/scope ok`.

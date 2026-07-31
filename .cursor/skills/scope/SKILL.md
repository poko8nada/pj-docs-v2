---
name: scope
description: >-
  Agree Theme / In / Out, set label, open unlock.scope.
  Use when session focus must be locked or unlock.scope is not open.
  Prose agreement is not a substitute for reading this file. Close: `/discussion`.
---

# scope

Lock session focus, set label, open `unlock.scope`.

## Steps

1. Agree Theme (add In / Out when boundaries matter). Theme alone is enough when clear.
2. On reject: revise (do not repeat the same block). One clarifying question at most. Wrong Theme → rewrite Theme first; wrong boundaries → fix In / Out. Topic change → re-agree and update label.
3. When Theme is stable, set label:

```bash
node .cursor/skills/scope/scripts/set-label.mjs <label>
```

- 1–64 chars: letters / digits / `.` `_` `-` only
- Id from `CURSOR_CONVERSATION_ID` (do not pass by hand)
- Skip while Theme is fuzzy
- Smoke: `node .cursor/skills/scope/scripts/set-label.smoke.mjs`

4. Reading this file opens `unlock.scope`. Same Theme continuing → do not re-dump every turn. Close is `/discussion` only.

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

- Prose agreement does not open the gate — this file must be read.

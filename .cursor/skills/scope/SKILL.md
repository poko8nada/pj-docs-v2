---
name: scope
description: >-
  Agree this session’s Theme / In scope / Out of scope, set the conversation label, and open the scope gate.
  Primary caller: discussion — lock focus when change intent appears or before hands-on; work/chore/issue call when direction is still unsettled.
  Use before edits if the gate is not open (even when obvious). Theme-only is fine when boundaries are clear.
  Close is harness-only: user `/discussion` clears scope.
---

# scope

Lock **what this session is about**, set a short `label`, and open the harness scope gate so edits can proceed (after phase + `rules`).

### Always use

Even when the topic feels obvious. Do **not** skip because intent seems clear.

### Open

Running this skill opens `unlock.scope` (any phase; the harness detects the skill file Read).

### Close

User sends `/discussion` — harness clears `unlock.scope`. No separate close command.

Callers (`discussion` / `work` / `chore` / `issue`, etc.) decide _when_ direction is unsettled; this skill owns the agreement shape, label, and gate open.

## When to use

- Entering or continuing a session focus (discussion default; also when another skill needs a settled Theme)
- User asks for orientation (“what should we focus on?”)
- Returning from hands-on with a stalled or shifted direction
- Before `/work` or `/chore` edits if `scope` is not yet open

## When not to re-block

- Same agreed Theme, continuing the beat — do not re-dump the full block every turn
- User says “got it” / “move on” after agreement — proceed; gate stays open until `/discussion`

Light case: **Theme** alone in prose is enough. Use the full block when in/out boundaries matter.

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

### Good (Goal discussion)

- Theme: Goal covenant abstraction
- In scope: who benefits, what outcome we promise
- Out of scope: stack, screens, MVP feature list (Discover)

### Bad (feature drift)

- Theme: Build the todo app
- In scope: Next.js, drag-and-drop, auth
- Out of scope: (empty)

## If the user rejects

1. Do not repeat the same block unchanged — revise Theme and/or In scope / Out of scope.
2. One clarifying question at most, then a revised block if still blocked.
3. Treat rejection as flawed scope judgment (see `AGENTS.md`); do not argue or push `/work`.
4. If Theme is wrong → rewrite Theme first; thin In scope until aligned.
5. If boundaries are wrong → keep Theme; fix In scope / Out of scope.
6. User changes topic → drop the old scope; follow the new thread (re-agree; update label).

## Label

Once Theme is stable (or when it changes enough that the old slug misleads), set the conversation label:

```bash
node .cursor/skills/scope/scripts/set-label.mjs <label>
```

- `<label>`: 1–64 chars, letters / digits / `.` `_` `-` only (e.g. `scope-gate`)
- Conversation id comes from `CURSOR_CONVERSATION_ID` in the agent Shell (do not pass id by hand)
- Updates state `label` only; allowed in any phase
- Skip while Theme is still fuzzy

Smoke: `node .cursor/skills/scope/scripts/set-label.smoke.mjs`

## Flow

1. Agree Theme (and In / Out when needed).
2. Set label when Theme is stable.
3. Running this skill already opened `unlock.scope` — hands-on phases may then run `rules` and edit.
4. When the scoped work is done, user returns via `/discussion` (closes `unlock.scope`).

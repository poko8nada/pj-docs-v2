---
name: annotate
description: "Manage agent context notes (AN comments) left in code. Collect existing notes, assess relevance, mark resolved ones as [done], and add new notes for future sessions. Trigger at phase transitions or when the agent identifies context worth preserving."
---

# Annotate

Leave breadcrumbs in the code for future sessions. AN comments are agent-driven context notes — they capture blockers, assumptions, and implementation status that issue comments alone don't convey.

## Comment Format

```
AN[{phase}][{priority}]: {comment}
```

- `{phase}`: design, build, refine, chore — the phase when the note was written
- `{priority}`: 1 = critical/blocker, 2 = important context, 3 = informational

```ts
// AN[design][1]: データ構造が仮置き。feasibility 必須。
// AN[build][2]: buildHierarchy() は仮実装。fractional indexing に差し替え予定。
```

## Flow

```
Step 1: Collect existing AN comments
Step 2: Assess relevance — mark [done] if resolved
Step 3: Add new notes for current context
```

---

## Step 1 — Collect

```bash
grep -rn "AN\[" . --exclude-dir={node_modules,.git,dist} | grep -v "\[done\]"
```

Read each comment and its surrounding code. Understand what it refers to.

## Step 2 — Assess & Mark Done

For each pending AN comment, check if it's still relevant:

- **Resolved** → mark as `AN[{phase}][{priority}][done]` (pre-commit will auto-delete)
- **Still relevant** → leave as is
- **Uncertain** → leave as is, mention in chat

Do NOT delete comments directly — only mark [done]. The lefthook handles actual deletion.

## Step 3 — Add New Notes

Identify context worth preserving for future sessions:

- Current blockers or unresolved issues
- Assumptions made during implementation
- Temporary workarounds with rationale
- Code that will need revisiting

Write new AN comments inline, near the relevant code. Keep them concise — one line per note.

## After this

Briefly report: how many notes were marked [done], how many remain, and what new notes were added.

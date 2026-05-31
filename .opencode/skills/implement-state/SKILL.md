---
name: implement-state
description: Use when implementing state management — local state, global state, server state, or data fetching.
compatibility: opencode
---

## Steps

Follow these steps in order. Never skip or combine steps.

### Step 1 — Define the unit

Research existing state management patterns before proposing the approach.

State what state will be managed and how it flows. Confirm scope with the user before proceeding.

### Step 2 — Implement

Build one complete state unit. Define the shape, transitions, and side effects fully.

### Step 3 — Verify

Create a “To-Do” list below to use the to-do tool.

- [ ] State transitions work as intended
- [ ] Edge cases handled: empty, loading, error

Fix any failures before proceeding.

### Step 4 — Propose and align

Before asking the user, summarize what was built and why it meets the agreed unit definition.
Use the `question` tool. Start the message with `[Context: zero / partial / sufficient / ready]`:

「[結果の要約]。この結果を確認してください。次に進んでよいですか？」

**This is Agreement Point 2.**

- Approved → `/apply-pattern [remaining targets]`
- Changes needed → return to Step 2
- Done → return to `/build-awareness`

### Step 5 — Expand or stop

- Approved → `/apply-pattern [remaining targets]`
- Changes needed → return to Step 2
- Done → return to `/build-awareness`

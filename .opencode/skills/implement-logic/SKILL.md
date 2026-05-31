---
name: implement-logic
description: Use when implementing business logic, utility functions, pure functions, or any logic that is not UI, state, API, or DB.
compatibility: opencode
---

## Steps

Follow these steps in order. Never skip or combine steps.

### Step 1 — Define the unit

Research existing patterns in the codebase before proposing the implementation approach.

State in one sentence what logic will be implemented, its input/output shape, and edge cases. Confirm with the user before proceeding.

### Step 2 — Implement

Build one complete unit. Not a stub — correct logic, edge cases handled, no side effects unless intentional.

### Step 3 — Verify

Create a “To-Do” list below to use the to-do tool.

- [ ] Logic produces correct output for expected inputs
- [ ] Edge cases handled: null, empty, unexpected input

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

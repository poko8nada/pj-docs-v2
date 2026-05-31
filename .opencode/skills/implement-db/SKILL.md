---
name: implement-db
description: Use when implementing database changes — schema design, migrations, or query logic.
compatibility: opencode
---

## Steps

Follow these steps in order. Never skip or combine steps.

### Step 1 — Define the unit

State what schema change or query will be implemented. Confirm with the user before proceeding.

**Before proceeding, confirm:**

- Is this a destructive change? (dropping columns, tables, or data)
- Is a migration needed?

### Step 2 — Implement

Build one complete unit. Not a stub — correct schema, constraints, and indexes.
For destructive changes, write the rollback migration first.

### Step 3 — Verify

Create a “To-Do” list below to use the to-do tool.

- [ ] Migration runs without errors
- [ ] Rollback runs without errors
- [ ] Query returns expected shape
- [ ] Edge cases handled: null, empty, constraint violations

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

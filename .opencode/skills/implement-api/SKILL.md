---
name: implement-api
description: Use when implementing API endpoints, server-side logic, or external service integrations.
compatibility: opencode
---

## Steps

Follow these steps in order. Never skip or combine steps.

### Step 1 — Define the unit

Research existing API patterns and external docs via Context7 before proposing.

State what endpoint or integration will be built, its input/output shape, and error cases. Confirm with the user before proceeding.

### Step 2 — Implement

Build one complete endpoint or integration. Not a stub — correct request handling, response shape, and error handling.

### Step 3 — Verify

Create a “To-Do” list below to use the to-do tool.

- [ ] Response shape is correct
- [ ] Error cases are handled
- [ ] Edge cases handled: empty, null, unexpected input

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

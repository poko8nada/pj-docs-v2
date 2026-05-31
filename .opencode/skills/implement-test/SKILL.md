---
name: implement-test
description: Use when implementing tests — unit tests, integration tests, or end-to-end tests.
compatibility: opencode
---

## Steps

Follow these steps in order. Never skip or combine steps.

### Step 1 — Define the unit

State what will be tested and why. Focus on error paths first, then critical happy paths.
Confirm scope with the user before proceeding.

### Step 2 — Implement

Write one complete test unit. Not a placeholder — real assertions, real edge cases.

Priority:

1. Error paths — all anticipated failures must be covered
2. Critical happy path — the path that returns a result after surviving error paths
3. Everything else — only if explicitly agreed

### Step 3 — Verify

Create a “To-Do” list below to use the to-do tool.

- [ ] TypeScript: zero errors
- [ ] Lint: zero errors
- [ ] Tests pass
- [ ] Error paths are covered
- [ ] No redundant or trivial assertions

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

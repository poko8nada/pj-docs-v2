---
name: implement-config
description: Use when implementing configuration — environment variables, build settings, tooling config, or deployment settings.
compatibility: opencode
---

## Steps

Follow these steps in order. Never skip or combine steps.

### Step 1 — Define the unit

State what configuration will be changed and why. Confirm with the user before proceeding.

**Before proceeding, confirm:**

- Does this change affect other environments? (dev, staging, production)
- Are there secrets or sensitive values involved?

### Step 2 — Implement

Apply one complete configuration change. Not a partial fix — correct values, correct scope, documented if non-obvious.

### Step 3 — Verify

Create a “To-Do” list below to use the to-do tool.

- [ ] Configuration is applied correctly in the target environment
- [ ] No sensitive values are hardcoded or committed

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

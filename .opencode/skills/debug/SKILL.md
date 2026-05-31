---
name: debug
description: Use when something is broken, behaving unexpectedly, or the cause is unknown. Prevents blind fixes by enforcing hypothesis-driven debugging.
compatibility: opencode
---

## Steps

Follow these steps in order. Never skip or combine steps.

### Step 1 — Describe the problem

State in one sentence what is broken and what was expected.
Do not attempt a fix yet.

### Step 2 — Form a hypothesis

Research the codebase, logs, and web before forming a hypothesis.
Use the `question` tool. Start with `[Context: zero / partial / sufficient / ready]`:「[仮説の説明]。この方向で調査してよいですか？」

### Step 3 — Verify the hypothesis

Take the single smallest action to confirm or deny the hypothesis:

- Read a file
- Check a log
- Search the web
- Ask the user one question

Do not fix anything yet. Do not combine multiple actions.

### Step 4 — Evaluate

Did the hypothesis hold?

- Yes → proceed to Step 5
- No → return to Step 2 with updated hypothesis

### Step 5 — Fix

Apply the minimal fix that resolves the confirmed cause. Nothing more.

### Step 6 — Verify

- [ ] TypeScript: zero errors
- [ ] Lint: zero errors
- [ ] Build: passes
- [ ] The original problem is resolved
- [ ] No new issues introduced

### Step 7 — Propose and align

Before asking the user, summarize what was built and why it meets the agreed unit definition.
Use the `question` tool. Start the message with `[Context: zero / partial / sufficient / ready]`:

「[結果の要約]。この結果を確認してください。次に進んでよいですか？」

**This is Agreement Point 2.**

- Approved → `/apply-pattern [remaining targets]`
- Changes needed → return to Step 2
- Done → return to `/build-awareness`

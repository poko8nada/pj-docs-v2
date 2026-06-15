---
name: debug
description: Trigger when the user reports a bug, when tests fail unexpectedly, or when behavior doesn't match expectations. Hypothesis-driven — never guess, verify first.
compatibility: opencode
---

# Skill: debug

Find and fix the root cause. Never guess — form a hypothesis, verify it, then fix.

## Steps

### Step 1 — Describe the problem

State in one sentence what is broken and what was expected.
Do not attempt a fix yet.

### Step 2 — Form a hypothesis

Research the codebase, logs, and web before forming a hypothesis.
Use the `question` tool:「[仮説の説明]。この方向で調査してよいですか？」

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

### Step 7 — Confirm

List what was fixed and why. Make it clear what the user should check.

「[修正内容の要約]。この結果を確認してください。次に進んでよいですか？」

- Approved → the agent proposes the next step based on the discussion
- Changes needed → return to Step 2

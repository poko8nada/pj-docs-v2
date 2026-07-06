---
name: debug
description: Trigger when the user reports a bug, when tests fail unexpectedly, or when behavior doesn't match expectations. Hypothesis-driven — never guess, verify first.
compatibility: opencode
---

# debug

Find and fix the root cause. Never guess — form a hypothesis, verify it, then fix.

## Steps

### Step 1 — Describe the problem

State in one sentence what is broken and what was expected.
Do not attempt a fix yet.

### Step 2 — Analyze & hypothesize

Research the codebase to understand the problem in context. Present your full analysis in one message:

**Context** (max 2 sentences)
{current project phase, relevant files/code, what led to this bug}

**Understanding** (max 3 sentences)
{your analysis of what's happening and why — trace the logic, identify the scope}

**Hypothesis**
{specific root cause candidate. one sentence.}

Discuss with the user. Revise your analysis based on their feedback. Repeat until the understanding and hypothesis are agreed. Do not proceed to Step 3 until alignment is reached.

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

Use the `question` tool:「[修正内容の要約]。この結果を確認してください。次に進んでよいですか？」

- Approved → the agent proposes the next step based on the discussion
- Changes needed → return to Step 2

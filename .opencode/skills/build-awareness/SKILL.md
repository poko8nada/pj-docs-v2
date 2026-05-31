---
name: build-awareness
description: Run at the start of `every turn` before doing anything else. Required to surface current state and align with the user before any action.
compatibility: opencode
---

## Context Level Guide

Context level measures how well you understand the current situation. It must change every turn based on what you learned.

- zero: Almost nothing is known. Must ask or research before forming any opinion.
- partial: Key unknowns remain. Do not propose a plan yet.
- sufficient: Enough to propose a plan. Some details may still be unclear.
- ready: Full understanding. Ready to act with high confidence.

**Rules:**

- Never jump more than 2 levels per turn.
- If a new unknown emerges, level goes down.
- Level resets to 1 at the start of every new session.

## Steps

Follow these steps in order. Never skip or combine steps.

### Step 1 — Orient

Output in Japanese using exactly this format:

```markdown
- Topic: [what is being discussed in this session in one sentence]
- Current focus: [what is actively being worked on or blocked by]
- Gate: [what "done" looks like for this session]
- Context: [context level as `zero / partial / sufficient / ready`]
- Related skills: [applicable skills, or "none"]
- Next action: [what to do next in one sentence]
```

> Note: **At the start of a session, the context is, of course, “1”.**

### Step 2 — Fill context if needed

If context level is below 7, take exactly one of these actions, then return to **Step 1**:

- Use a related skill if applicable
- Search the web or fetch docs via Context7
- Research and form a hypothesis, then present it to the user

Do not think in isolation. Do not combine actions. Pick one, execute, return.

### Step 3 — Propose a plan

Research and form a concrete plan before asking the user anything.

- First unit: Complete one unit end-to-end before moving to the next.
- End-to-end means: take one thing all the way from start to finish — fully working and verifiable by the user.
- Wrong: Apply the same change across multiple units first, then verify everything at once.
- Right: Take one unit all the way to completion, confirm with the user, then move to the next.

Plan must follow this format:

```markdown
- Session Gate: [what done looks like]
- Skills: [which skills will be used and in what order]
- First unit: [exactly what will be built first]
- Target: [list of target, including first unit]
```

Use the `question` tool to present the plan. Start the message with `[Context: zero / partial / sufficient / ready]`.

**This is Agreement Point 1.**

Wait for explicit approval before proceeding.

### Step 4 — Act

Execute the first unit only. Use the appropriate skill:

- UI/markup/behavior/design → `implement-ui`
- Business logic/utilities → `implement-logic`
- State management → `implement-state`
- API/server → `implement-api`
- Database → `implement-db`
- Tests → `implement-test`
- Configuration → `implement-config`
- Something broken → `debug`

### Step 5 — Return and gate

Report the result. Use the `question` tool. Start the message with `[Context: zero / partial / sufficient / ready]`.

「この結果を確認してください。次に進んでよいですか？」

**This is Agreement Point 2.**

- Approved → `/apply-pattern [remaining targets]`
- Changes needed → return to Step 4
- Done → return to Step 1

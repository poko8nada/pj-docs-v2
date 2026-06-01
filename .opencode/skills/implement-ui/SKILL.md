---
name: implement-ui
description: Use when implementing any UI — component structure, markup, interactive behavior, or visual design.
compatibility: opencode
---

## Steps

Follow these steps in order. Never skip or combine steps.

### Step 1 — Define the unit

State in one sentence what will be built. Confirm with the user before proceeding.

### Step 2 — Implement

Build one complete unit. Not a stub — correct structure, behavior, fully styled and responsive.

### Step 3 — Verify

Create a “To-Do” list below to use the to-do tool.

- [ ] Browser: structure and behavior work as intended via `cmux browser *`
  - NOTE:
    - If `localhost:XXXX` has already be runnning, direclty access by `cmux browser *`, not to run script again.
    - If not, run `pnpm run dev` then access by `cmux browser *`.
- [ ] Semantically accurate and accessible
- [ ] Visually correct and responsive
- [ ] Consistent with the rest of the system (tokens, spacing, color)

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

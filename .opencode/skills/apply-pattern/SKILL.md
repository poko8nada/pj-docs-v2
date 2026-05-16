---
name: apply-pattern
description: Use after the user has approved a complete unit. Apply the same approach to all remaining units comprehensively, in parallel, and efficiently. Confirm with the user once at the end.
compatibility: opencode
---

## Steps

Follow these steps in order. Never skip or combine steps.

### Step 1 — Define remaining scope

List all remaining units that follow the same pattern as the approved unit.
Use the `question` tool to confirm the list with the user before proceeding.

### Step 2 — Apply all remaining units

Apply the approved pattern to all remaining units comprehensively, in parallel, and efficiently.
This is the execution phase — do not stop between units to ask for confirmation.
Do not omit any unit. Do not apply partially.

### Step 3 — Verify all

Create a “To-Do” list below to use the to-do tool.  
Run checks across all applied units:

- [ ] TypeScript: zero errors
- [ ] Lint: zero errors
- [ ] Build: passes
- [ ] Result matches the approved pattern

Fix any failures before proceeding.

### Step 4 — Confirm once

Use the `question` tool:「全ユニットへの適用が完了しました。確認してください。」

- Changes needed → fix and return to Step 3
- Done → return to `/build-awareness`

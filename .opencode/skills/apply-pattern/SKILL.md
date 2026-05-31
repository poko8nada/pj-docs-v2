---
name: apply-pattern
description: Use this after Agreement Point 2 has been fulfilled and the user has approved a complete unit. Using the `task` tool, delegate the same task—using the same approach—to the `apply` subagent for all remaining units in a comprehensive, parallel, and efficient manner.
compatibility: opencode
---

## Steps

Follow these steps in order. Never skip or combine steps.

### Step 1 — Confirm remaining scope

List all remaining targets that follow the same pattern as the approved unit.
Use the `question` tool to confirm the list with the user. Start with `[Context: zero / partial / sufficient / ready]`.

Wait for explicit approval before proceeding.

### Step 2 — Delegate to apply subagent

Invoke the `apply` subagent using the Task tool with:

- The approved unit as the reference pattern
- The confirmed list of remaining targets
- Any constraints or edge cases identified in Step 1

### Step 3 — Review result

Fix any failures before proceeding.

### Step 4 — Confirm once

Use the `question` tool:「全ユニットへの適用が完了しました。確認してください。」

- Changes needed → fix and return to Step 3
- Done → return to `/build-awareness`

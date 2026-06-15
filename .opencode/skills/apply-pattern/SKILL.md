---
name: apply-pattern
description: Trigger after a unit is approved and remaining targets need the same pattern. Delegates to the apply subagent for parallel execution.
compatibility: opencode
---

# Skill: apply-pattern

Apply an approved pattern to all remaining targets. Delegates to the apply subagent for comprehensive, parallel execution.

## Steps

### Step 1 — Confirm remaining scope

List all remaining targets that follow the same pattern as the approved unit.
Use the `question` tool to confirm the list with the user.

Wait for explicit approval before proceeding.

### Step 2 — Delegate to apply subagent

Invoke the `apply` subagent using the Task tool with:

- The approved unit as the reference pattern
- The confirmed list of remaining targets
- Any constraints or edge cases identified in Step 1

### Step 3 — Review result

Fix any failures before proceeding.

### Step 4 — Confirm

「全ユニットへの適用が完了しました。確認してください。」

- Changes needed → fix and return to Step 3
- Done → the agent proposes the next step based on the discussion

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

If the pattern was revised after the initial design, re-validate the
apply target list: some targets may no longer fit the new pattern,
and new candidates may have emerged during the build.

Wait for explicit approval before proceeding.

### Step 2 — Delegate to apply subagent

Invoke the `apply` subagent using the Task tool with:

- The approved unit as the reference pattern
- The confirmed list of remaining targets
- Any constraints or edge cases identified in Step 1
- Instruction: report any additional candidates that match the pattern but were not in the original list

### Step 3 — Review result

Review the subagent's output:

- For each target: did the application succeed? Are the changes correct?
- New candidates not in the original list: present to the user, decide if scope extends

Fix any failures before proceeding.

### Step 4 — Confirm

「全ユニットへの適用が完了しました。確認してください。」

- Changes needed → fix and return to Step 3
- Done → the agent proposes the next step based on the discussion

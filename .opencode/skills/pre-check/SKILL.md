---
name: pre-check
description: Trigger when the work is a vertical slice (1 end-to-end flow with a structural pattern that can be applied to other targets). Articulate the slice, the pattern, the apply targets, and the risks. Get user agreement before building.
compatibility: opencode
---

# Skill: pre-check

Trigger this skill when the work is a vertical slice: 1 end-to-end flow with a structural pattern that can be applied to other targets. Confirms the unit structure — locks it in so the build phase can run without reopening decisions.

## When to use

The work is a vertical slice: 1 end-to-end flow with a structural pattern that can be applied to other targets.

If the work is a one-off trivial change (typo fix, single variable rename, one-line config change), this skill is not needed — the build can proceed directly.

## Sections

Use the `question` tool or chat to present the following. Each section locks in a decision. The user may revisit a section before moving on.

### Slice — the 1 vertical end-to-end flow

Describe the 1 vertical end-to-end flow this unit establishes. 1 sentence. The flow should include the main path and the error cases (e.g., "list() returns ok(items) on success, err({kind: 'io'}) on file missing, err({kind: 'parse'}) on bad JSON").

The user confirms: is this the right flow to build?

### Pattern — the structural approach

Describe the structural approach this slice establishes, including the rationale (why this way, what was considered, what was rejected). This is what will be applied to the remaining targets in the apply phase.

The user confirms: is this the right abstraction? Will it hold for the apply targets?

### Apply targets — other flows using the same pattern

List of other flows that will use the same pattern. These are not implemented in this unit — they are applied in the apply phase after the slice is built and approved.

Example:
- list() with parse error (same pattern, different kind)
- get() with not-found (T | undefined instead of Result, but same consumer branching)
- get() with IO error (throw instead of Result, but same JSDoc pattern)
- create / update / delete (interface only for v1)

If the work is genuinely one-off with no recurrence, write "none".

### Risks & Gaps — open issues

List any acknowledged risks, tentative agreements, and gaps we've agreed to leave. Don't reopen them — acknowledge them.

## Hand off

After all sections are agreed, the agent proceeds to the build phase. The user can re-trigger this skill at any time to revisit decisions.

After the slice is built and the user confirms the pattern is validated, the apply phase handles the apply targets. If the user flags the pattern as needing adjustment, this skill is re-triggered. The re-trigger focuses on the section(s) that need revision (typically the pattern, possibly the apply targets and risks); the slice is preserved unless it also needs to change. The build phase then runs again with the revised pattern, going directly to the Build step (skipping the When to use gate, since the vertical slice was already confirmed).

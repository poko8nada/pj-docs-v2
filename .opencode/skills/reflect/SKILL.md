---
name: reflect
description: Trigger proactively when the session has drifted from its original direction, when multiple threads are tangled, when the user expresses confusion about the Goal or Gate, or when the agent itself is uncertain about the current direction. This is a mid-session reorientation — not a checkpoint before actions. Compact but complete.
---

# Skill: reflect

Pull everything together from the current session. Show the full state in a compact format, list meaningful decisions and discussions, and verify the direction.

## When to use

- The discussion has accumulated several decisions and the user wants to see them
- The user asks "where are we?" or "what have we decided?"
- The agent determines the conversation has gone off track and needs to reorient
- Before a major decision (e.g., before triggering /implement or /issue)

## What to show

```markdown
# [Topic]

## Goal & Gate

**Goal:** [what we agreed to achieve] — [state: open / tentative / agreed]
**Gate:** [what "done" looks like] — [state: open / tentative / agreed]

## Meaningful discussions

Each row is something that contributed — a decision, an insight, a change in understanding, or a lesson learned. Routine confirmations and abandoned discussions are not included.

| Phase   | Topic                | Outcome  |
| ------- | -------------------- | -------- |
| [phase] | [what was discussed] | [result] |

**Include a row if the discussion:**

- Led to a decision
- Revealed a new option or insight
- Changed understanding
- Prevented a future mistake

**Skip if it is just:**

- Routine confirmation ("OK", "yes", "continue")
- Repeated discussion of the same point
- Abandoned discussion with no result

Detours are not automatically excluded. A detour that produced an insight is meaningful. The criterion is contribution, not on-topic-ness.

## Decisions

| Decision   | Context              | Rationale                               |
| ---------- | -------------------- | --------------------------------------- |
| [decision] | [what was discussed] | [why this was chosen over alternatives] |

## Risks & Gaps

| Item          | State                       | Why it matters         |
| ------------- | --------------------------- | ---------------------- |
| [risk or gap] | [open / tentative / agreed] | [impact if unresolved] |

## Open

| Question              | Why it's blocking              |
| --------------------- | ------------------------------ |
| [unresolved question] | [what's preventing resolution] |

## Direction

Is the current Goal still what we want? Is the Gate still the right measure of done?

- [ ] Goal still valid
- [ ] Gate still valid
- [ ] No drift in scope
```

## After showing

Ask the user:

「これで状況は合ってますか？直すところや追加したいことはありますか？」

- If the user confirms → continue with the next step
- If the user wants to change something → update the orient and relevant areas
- If the user wants to abandon the direction → return to setup or start over

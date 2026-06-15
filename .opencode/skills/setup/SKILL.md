---
name: setup
description: Trigger at the start of every session. Also trigger when the user switches topic, when context is unclear, or when the working environment needs cleanup.
compatibility: opencode
---

# Skill: setup

Set the Session Goal and Session Gate. Clean up the working environment. Identify what's needed or blocking. Then propose the next step when both agree it's time to move forward.

## Git cleanup

Before anything else, check the working environment:

- Is the working tree clean? If not, stash or commit as needed.
- Are there uncommitted changes? If so, ask the user what to do with them.
- Is the branch correct? If not, confirm with the user before switching.
- Is a new branch needed? If the work is significant, consider creating a feature branch. If it's a quick fix, dev or main may be fine.

## Understand intent

Ask the user what they want to do. If unclear, ask clarifying questions. Use Context7 MCP and web search to research before proposing.

## Set Goal and Gate

Goal: what to achieve (1 sentence, short).
Gate: what "done" looks like (verifiable, short).

## Risks & Gaps

Identify what's needed or blocking. Don't list every detail — just the overall state. Use another skill (may be `/reflect`) during discussion to organize and review everything in detail.

## Orient (minimal)

Show the current state of agreement. Keep it short.

```markdown
# [Topic]

**Goal:** [very short] — [state: open / tentative / agreed]
**Gate:** [very short] — [state: open / tentative / agreed]
**Risks & Gaps:** [overall state: open / tentative / agreed]
```

## Hand off

When Goal and Gate are agreed and Risks & Gaps are addressed, the agent proposes the next step based on the discussion.

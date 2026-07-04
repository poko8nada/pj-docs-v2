---
description: Set a specific project phase for the session.
---

[setup] $1

$1 is one of project phase. `[design, build, refine, chore]`

If $1 is not provided, show an error:
"Phase is required. Usage: /setup <phase>"

## Agent behavior

1. If phase is provided:

**NOW YOU ARE IN $1 PHASE**

- user set `chore`, then ask what to do.
- user set `design`, `build`, or `refine`, then check all registered issues.
  - If a matching issue is found, retrieve its comments and present the current status to the user.
  - If no match is found, suggest that the user create an issue and load the `issue` skill.

2. If phase is omitted:

- Show error message
- Stop

## After this

The user will tell you what to do next. Wait for their instruction.

---

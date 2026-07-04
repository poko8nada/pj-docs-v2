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

- user set `chore` → ask what to do.
- user set `design`, `build`, or `refine` → check all registered issues.

  **If a matching issue is found**, do NOT just summarize the title. Verify the facts:
  1. Read the issue body AND all comments.
  2. Confirm the phase from the title prefix (`[Design]` = design, `[Build]` = build, `[Refine]` = refine).
  3. Check the codebase — what files exist? What's described in the issue but missing?
  4. Grep for context comments left in the codebase:
     - `grep -rn "UO\[" . --exclude-dir={node_modules,.git,dist} | grep -v "\[done\]"`
       UO = User Opinion. Issues the user flagged that need resolution.
     - `grep -rn "AN\[" . --exclude-dir={node_modules,.git,dist} | grep -v "\[done\]"`
       AN = Agent Note. Context left by previous sessions (blockers, assumptions, status).
       Read and incorporate both into your understanding.
  5. Identify the current blocker — what's preventing progress within this phase. Look at:
     - Latest comments
     - UO/AN grep results
     - Codebase vs issue description gap
  6. Present a structured status. Do NOT discuss topics outside the current phase:

  ```
  **Status** (max 2 sentences)
  {phase, what's been decided, what's built, what's missing}

  **Blocker or Unresolved** (max 2 sentences — required)
  {what's preventing progress within this [$1] phase. Check comments, AN notes, codebase gaps.
   Do NOT say "no blockers" — state what needs to happen next.}

  **Next** (max 1 sentence)
  {proposed next action within this [$1] phase — which skill, which approach}
  ```

  7. Wait for user agreement before proposing any skill or action.

  **If no matching issue is found** → suggest creating one and load the `issue` skill.

2. If phase is omitted:

- Show error message
- Stop

## After this

The user will tell you what to do next. Wait for their instruction.

---

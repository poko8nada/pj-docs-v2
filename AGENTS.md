# AGENTS.md

## Purpose

The agent and the user work together — both propose, both discuss, both agree. Every step is a joint decision.

## Principles

1. **Proactive** — the agent actively proposes, researches, and suggests. Don't wait for the user to ask.
2. **Agreement** — act only with user approval. The agent proposes, the user confirms.
3. **Incremental** — one evaluable unit at a time. Build the smallest thing the user can test and judge, then get approval before expanding.
4. **Transparency** — no silent scope changes. Every action is visible to the user.
5. **Verifiability** — make verification clear. List what changed and what to check, so the user never asks "what am I looking at?"

## How a session works

There is no fixed flow. The user and the agent pick the next step together. The agent proactively suggests and triggers skills based on context. Discussion runs between every step.

- **Session start** → `/setup` (Goal/Gate, git cleanup, context)
- **Tracking substantial work** → `/issue` (use the issue as the plan; same trigger as creating a new branch in /setup)
- **Implementation** → `/implement` (Pre-check → Build → Verify → Confirm)
- **After approval** → `/apply-pattern` (if pattern scope was decided in Pre-check)
- **During discussion** → `/reflect` (progress review, direction check)
- **Session end** → `/session-cleanup` (commit, push, PR, branch cleanup; use /memory for meta insights)

Skills provide specialized instructions and workflows for specific tasks.
Use the skill tool to load a skill when a task matches its description.

## Communication style

English to think, Japanese to speak — token efficiency without losing human touch.

## Meta

- Issues: created only for substantial work (same trigger as creating a new branch in /setup). No strict "1 issue = 1 feature" rule.
- Use pnpm for all package management. Scripts in package.json are ready to use.
- The development environment is always operational (vertical slice).

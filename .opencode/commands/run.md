---
description: Execute the agreed slice plan.
---

[run] $1

# Argument

`$1`:

- `all` → execute the whole plan in one turn. See "all flow".
- empty → execute with slice confirmation. See "default flow".

# About `all`

`all` is a convenience for users who explicitly want the entire plan in one turn.

**The agent MUST NEVER suggest `all` to the user** — not as a default, not as a recommendation, not as a time-saver. The default flow exists for incremental verification and user control. `all` bypasses both.

If the user types `[run] all`, the agent executes `all`. Otherwise the agent uses the default flow with slice confirmation.

# Default flow

1. Read the agreed plan from session context (the plan in the issue body, the last `question` approval, or the current `todowrite`).
2. Use the `question` tool to present slice options. Wait for the answer.
3. Mark the chosen slice in `todowrite` as `in_progress`.
4. Execute ONLY the chosen slice. Do not touch out-of-scope slices.
5. Run verification as needed: `pnpm typecheck && pnpm lint && pnpm format:check`.
6. Mark the executed slice as `completed` in `todowrite`.
7. Present a confirm message (changed files, deviations, verification result).
8. Stop. Do not proceed to the next slice. The next `/run` continues.

# all flow

1. Read the agreed plan.
2. Mark all slices in `todowrite` as `in_progress`.
3. Execute all slices.
4. Run verification once: `pnpm typecheck && pnpm lint && pnpm format:check`.
5. Mark all slices as `completed` in `todowrite`.
6. Present a final confirm message.
7. Stop. The user can interrupt with `STOP` (lightweight) or `RESET` (full state clear).

# What "all" means (HARD boundary)

`all` = the entire plan's implementation, **up to and including verification**. It does NOT include:

- `git add` / `git commit` / `git push` / `gh pr create`
- `gh issue edit` / `gh issue comment`
- Creating branches, tags, releases
- Any external state mutation beyond the local repo

These are deliberate, separate user actions. `force_review.ts` would block an unprompted commit anyway, but state it explicitly.

# Edge cases

- If the plan has only 1 slice, present 1 option (do not artificially split).
- If only 1 slice remains after prior runs, present 1 option.
- If 0 remain, say "plan complete" in chat (no question tool).

# Continuation

On subsequent `[run]` invocations, read `todowrite` to identify completed slices. Stage the REMAINING slices. If only 1 remains, present 1 option. If 2 remain, present both + "all". If all are done, say so in chat (no question tool).

# Stopping

While in `[run] all` (or while running a default-flow slice), interrupt by typing `STOP` on its own line. This closes the gate but keeps phase and skills loaded — resume with another `[run]`. For a full reset (clear phase, skills, run state), use `RESET` instead. Do NOT include `STOP` in any other text. It is a trigger, not a word.

# Chore phase

No formal plan. The "plan" is whatever the user described in chat before `/run`. If the chat is silent, ask the user in chat (not via question tool) what to do. If the change is one file or one concern, present 1 option. If it spans 2–3 files/areas, present 2–3 options. Do NOT invent concerns the user did not raise.

# Spec state (project's initial concept, no spec issue yet)

The very beginning — the user is thinking about what the project should be. No spec issue exists, no plan, no phase set. `/run` does NOT apply here. Tell the user in chat (not question tool):

"`/run` requires a phase and an agreed plan. Current state has neither. Suggested path: 1) discuss the project until aligned, 2) run the issue skill to create a [Spec] issue, 3) /setup design (or build / refine) and use the prepare skill to produce a plan, 4) then /run."

Do not use the question tool. Do not present stages.

# No plan / unrecognized state

Tell the user in chat: "`/run` requires a phase and an agreed plan. Run `/setup design/build/refine/chore` and follow the prepare skill to produce a plan." Do not use question tool.

# Hard rules

- The plan is the source of truth. Do not reopen settled questions.
- Out-of-scope slices = do not edit, even if related.
- "All" via the question option is the ONLY in-default-flow way to do the whole plan in one turn.
- Verification timing differs by flow: default flow runs `pnpm typecheck && pnpm lint && pnpm format:check` per slice (as needed). `all` flow runs verification ONCE at the end.
- `[run]` does not touch the issue body.
- In chore / spec / no-plan states, use chat (not question tool) to clarify.

---
description: Execute the agreed plan in stages.
---

[run] $1

# Argument

`$1`:

- `all` → run the whole plan, no stage question. See "all flow".
- empty → run with stage confirmation. See "default flow".

# About `all`

`all` is a convenience for users who explicitly want the entire plan in one turn. It exists because some agents ask for it constantly.

**The agent MUST NEVER suggest `all` to the user** — not as a default, not as a recommendation, not as a time-saver. The default flow exists for incremental verification and user control. `all` bypasses both.

If the user types `[run] all`, the agent executes `all`. Otherwise the agent uses the default flow with stage confirmation.

# Default flow

1. Read the agreed plan from session context (the plan displayed in prepare/build/refine Step 3, the last `question` approval, or the current `todowrite`).
2. Identify natural units. See "How to stage".
3. Use the `question` tool to present stage options. Wait for the answer.
4. Mark the chosen stage's units in `todowrite` as `in_progress`.
5. Execute ONLY the chosen stage. Do not touch out-of-scope units.
6. Run verification as needed: `pnpm typecheck && pnpm lint && pnpm format:check`.
7. Mark executed units as `completed` in `todowrite`.
8. Present a confirm message (changed files, deviations, verification result).
9. Stop. Do not proceed to the next stage. The next `/run` continues.

# all flow

1. Read the agreed plan.
2. Mark all units in `todowrite` as `in_progress`.
3. Execute the entire plan.
4. Run verification once: `pnpm typecheck && pnpm lint && pnpm format:check`.
5. Mark all units as `completed`.
6. Present a final confirm message.
7. Stop. The user can interrupt with `STOP` (lightweight) or `RESET` (full state clear).

# What "all" means (HARD boundary)

`all` = the entire plan's implementation, **up to and including verification**. It does NOT include:

- `git add` / `git commit` / `git push` / `gh pr create`
- Creating branches, tags, releases
- Any external state mutation beyond the local repo

These are deliberate, separate user actions. `force_review.ts` would block an unprompted commit anyway, but state it explicitly.

# How to stage (for the question tool)

The plan's units are PHASE-DEPENDENT. Match the current phase:

## build phase

The plan's units are vertical slices from `Order & Verify`. A slice is where a human would naturally draw the line — sized to finish in one sitting. Draft-first: prefer "throw something up that works" over "complete it before testing". Slices are sequenced with dependencies. Group adjacent slices by dependency: a slice that others depend on goes in the first stage.

## refine phase

Same slice structure as build. Each slice is tagged with impact tier (High / Medium / Low / Risky). Group by tier priority: High in stage 1, Medium in stage 2, Low in stage 3 (when applicable).

## design phase (app or web)

The natural units are finer than build's slices because the design work is sequential by nature. Each unit is its own stage — no bundling. The LLM must not skip stages or do multiple stages in one go.

### app

**Stage 1 — Project setup.**
Done: stack detected (read package.json + config), directory structure exists, component files scaffolded in production location.

**Stage 2 — Components.**
Done: each component is written in production location (not in `prototype/`), production-ready, with `data-component` attribute on the root element.

**Stage 3 — Default screen.**
Done: one screen file composes the components with hardcoded data covering edge cases. No interactivity. No fetched data. No state.

**Stage 4 — Component comments.**
Done: each component has the structured comment block (role / state / variants / props / interaction / 考慮事項) at the top of its file.

**Stage 5 — Discuss and iterate.**
Done: user has reviewed the screen in the browser and confirmed the visual direction.

**Stage 6 — Update the [Design] issue body.**
Done: the body has all spec sections filled (Style Guide, Component Matrix) — no `(TBD)` placeholders.

**Stage 7 — Hand off.**
Done: [Design] issue is closed, `Design完了` comment is on the [Spec] issue.

### web

**Stage 1 — Web type confirmation + project setup.**
Done: web type is confirmed (Large site / Small corporate / Blog / LP / Documentation), stack detected, directory structure exists.

**Stage 2 — Sections + components.**
Done: each section (Header, Footer, Hero, content per type) has its component written in production location with `data-component` attribute.

**Stage 3 — Default screen.**
Done: one screen file composes the type-specific sections with hardcoded data. No interactivity.

**Stage 4 — Component comments.**
Done: each component has the structured comment block at the top of its file.

**Stage 5 — Discuss and iterate.**
Done: user has reviewed the screen in the browser and confirmed the visual direction.

**Stage 6 — Update the [Design] issue body.**
Done: the body has all spec sections filled (Style Guide, Page Structure, Section Matrix) — no `(TBD)` placeholders.

**Stage 7 — Hand off.**
Done: [Design] issue is closed, `Design完了` comment is on the [Spec] issue.

Discussion / iteration is NEVER inside the build stages. The user must see the screen before the discussion stage starts.

## chore phase

No formal plan. The "plan" is whatever the user described in chat before `/run`. If the chat is silent, ask the user in chat (not via question tool) what to do. If the change is one file or one concern, present 1 option. If it spans 2–3 files/areas, present 2–3 options. Do NOT invent concerns the user did not raise.

## spec state (project's initial concept, no spec issue yet)

The very beginning — the user is thinking about what the project should be. No spec issue exists, no plan, no phase set. `/run` does NOT apply here. Tell the user in chat (not question tool):

"/run requires a phase and an agreed plan. Current state has neither. Suggested path: 1) discuss the project until aligned, 2) run the issue skill to create a [Spec] issue, 3) /setup design (or build / refine) and use the prepare skill to produce a plan, 4) then /run."

Do not use the question tool. Do not present stages.

## no plan / unrecognized state

Tell the user in chat: "/run requires a phase and an agreed plan. Run `/setup design/build/refine/chore` and follow the prepare skill to produce a plan." Do not use question tool.

# Edge cases

- If the plan has only 1 unit, present 1 option (do not artificially split).
- If only 1 unit remains after prior runs, present 1 option.
- If 0 remain, say "plan complete" in chat (no question tool).

# Continuation

On subsequent `/run` invocations, read `todowrite` to identify completed units. Stage the REMAINING units. If only 1 remains, present 1 option. If 2 remain, present both + "all". If all are done, say so in chat (no question tool).

# Stopping

While in `/run all` (or while running a default-flow stage), interrupt by typing `STOP` on its own line. This closes the gate but keeps phase and skills loaded — resume with another `/run`. For a full reset (clear phase, skills, run state), use `RESET` instead. Do NOT include `STOP` in any other text. It is a trigger, not a word.

# Hard rules

- The plan is the source of truth. Do not reopen settled questions.
- Out-of-scope units = do not edit, even if related.
- "All" via the question option is the ONLY in-default-flow way to do the whole plan in one turn.
- Verification timing differs by flow: default flow runs `pnpm typecheck && pnpm lint && pnpm format:check` per stage (as needed). `all` flow runs verification ONCE at the end.
- In chore / spec / no-plan states, use chat (not question tool) to clarify.

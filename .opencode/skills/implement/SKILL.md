---
name: implement
description: Trigger when Goal and Gate are clear, the unit is named and scoped, and no open questions block implementation. Covers UI, logic, state, API, database, and configuration — confirm what was discussed, then build, run automated checks with output shown, and get approval.
compatibility: opencode
---

# Skill: implement

Trigger this skill when it's time to build a unit. The unit may already be discussed in chat, or it may need a quick design check first.

## When to use

Before starting, ask: **Can this work be expressed as a vertical slice?** (1 end-to-end flow with a structural pattern that can be applied to other targets?)

If yes → trigger another design step to articulate the slice, pattern, and apply targets. Get user agreement before building.

If no → build directly. The change is a one-off, no recurring structure to articulate.

If re-running after a design revision (the design step was re-triggered because the pattern needed adjustment), skip this gate — the vertical slice was already confirmed. Go directly to Build.

### Examples

**Trivial — build directly:**

- Fix a typo
- Rename a single variable
- Change one line in an existing config file
- Add a new query param to an existing endpoint (existing structure absorbs it)

**Vertical slice — trigger design step first:**

- New endpoint (route + handler + test + UI integration = 1 end-to-end flow)
- New data source method (interface + impl + test + consumer + error UI = 1 end-to-end flow)
- New error path handling (interface + impl + test + consumer error branch + UI = 1 end-to-end flow)
- Cross-file refactor with a structural pattern that recurs

The actual articulation of slice / pattern / apply targets happens in the design step. The When to use here is the gate.

## Confirm what was discussed

When the user comes straight to build without a design check, recap the unit briefly and get approval. Don't reopen settled questions — lock them in.

If something is unclear, ask. If something needs research, do it now (Context7, web search, codebase).

## Build

Build exactly what was confirmed. Not a stub — correct structure, behavior, and edge cases handled.

Keep the development environment operational at all times. The user should be able to verify the result at any point.

If scope changes during implementation, confirm with the user before expanding.

## Verify

After Build, run automated checks and show output. **Do not proceed to Confirm without showing the user the output of these checks.**

Run:

- `pnpm typecheck`
- `pnpm lint`
- `pnpm format:check`
- `pnpm test:run` (if tests exist)

Show the output (or last N lines) before asking for Confirm.

For UI changes, also use cmux-browser to capture a snapshot and show it to the user. Data layer / API / type changes don't require browser verification.

Use the checklist for your implementation type. Fix any failures before proceeding.

### UI

- [ ] Browser: structure and behavior work as intended
- [ ] Semantically accurate and accessible
- [ ] Visually correct and responsive
- [ ] Consistent with the rest of the system

### Logic

- [ ] Logic produces correct output for expected inputs
- [ ] Edge cases handled: null, empty, unexpected input

### State

- [ ] State transitions work as intended
- [ ] Edge cases handled: empty, loading, error

### API

- [ ] Response shape is correct
- [ ] Error cases are handled
- [ ] Edge cases handled: null, empty, unexpected input

### Database

- [ ] Migration runs without errors
- [ ] Rollback runs without errors
- [ ] Query returns expected shape
- [ ] Destructive changes have rollback

### Configuration

- [ ] Configuration is applied correctly in the target environment
- [ ] No sensitive values are hardcoded or committed

### Test

- [ ] Error paths are covered (most important)
- [ ] Critical happy path is covered
- [ ] No redundant or trivial assertions

## Confirm

List the specific changes: which files, functions, components were created or modified. Include the output of the Verify checks (typecheck / lint / format / test).

If the work was a vertical slice (a design step was run), validate the pattern before proceeding:

> [Changed files / functions / components]. Did the built slice validate the pattern? Does it need adjustment (didn't fit, missing layer, wrong abstraction)?

- Pattern validated → trigger pattern application to the remaining targets
- Pattern needs adjustment → revise the pattern via the design step, then re-build
- Approved (trivial work, no pattern) → the user decides the next step
- Changes needed → return to Build

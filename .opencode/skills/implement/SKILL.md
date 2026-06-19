---
name: implement
description: Trigger when Goal and Gate are clear, the unit is named and scoped, and no open questions block implementation. Covers UI, logic, state, API, database, and configuration — confirm what was discussed, then build, run automated checks with output shown, and get approval.
compatibility: opencode
---

# Skill: implement

Trigger this skill when it's time to build a unit. The unit may
already be discussed in chat, or it may need a quick design check
first.

## Trivial skip judgment

Before starting, evaluate:

- Touches more than one file?
- Introduces new error paths?
- Calls library API in a new way?
- Changes a public interface (route, type, export)?

If any "yes" → non-trivial. Before building, suggest to the user:

> This looks like a design change. Want to do a design check first
> to clarify approach, error paths, and test scope? Or go straight
> to build?

The user decides. If they want a design check, pause and let them
trigger a planning step. If they want to build, proceed.

If all "no" → trivial. Build directly.

## Confirm what was discussed

When the user comes straight to build without a design check,
recap the unit briefly and get approval. Don't reopen settled
questions — lock them in.

If something is unclear, ask. If something needs research, do it
now (Context7, web search, codebase).

## Build

Build exactly what was confirmed. Not a stub — correct structure,
behavior, and edge cases handled.

Keep the development environment operational at all times. The
user should be able to verify the result at any point.

If scope changes during implementation, confirm with the user
before expanding.

## Verify

After Build, run automated checks and show output. **Do not
proceed to Confirm without showing the user the output of these
checks.**

Run:

- `pnpm typecheck`
- `pnpm lint`
- `pnpm format:check`
- `pnpm test:run` (if tests exist)

Show the output (or last N lines) before asking for Confirm.

For UI changes, also use cmux-browser to capture a snapshot and
show it to the user. Data layer / API / type changes don't
require browser verification.

Use the checklist for your implementation type. Fix any failures
before proceeding.

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

List the specific changes: which files, functions, components
were created or modified. Make it clear what the user should
check. Include the output of the Verify checks (typecheck / lint
/ format / test).

「[変更したファイル・関数・コンポーネントの一覧]。この結果を確認してください。次に進んでよいですか？」

- Approved + pattern scope → the agent applies the pattern to remaining targets
- Approved + single scope → next step (user decides)
- Changes needed → return to Build

---
name: implement
description: Trigger when Goal and Gate are clear, the unit is named and scoped, and no open questions block implementation. Covers UI, logic, state, API, database, and configuration — confirm what was discussed, then build, verify, and get approval.
compatibility: opencode
---

# Skill: implement

Trigger this skill when discussion has resolved what, why, scope, and uncertainties — and both the user and agent agree it's time to build.

## Pre-check

Confirm what was discussed. Don't reopen settled questions — lock them in and get approval to build.

Use the `question` tool to present:

### What — the unit to build

Name the files, functions, components, endpoints, tables, or settings as discussed.

| Type          | Specify                                        |
| ------------- | ---------------------------------------------- |
| UI            | component name, file path, behavior            |
| Logic         | function name, file path, input/output shape   |
| State         | state shape, transitions, file path            |
| API           | endpoint, request/response shape, file path    |
| Database      | table, migration, query, file path             |
| Configuration | environment variable, build setting, file path |

### Approach — why this way

Restate the approach and the reason it was chosen over alternatives.

### Scope — single or pattern

- **Single**: one-off, no remaining targets
- **Pattern**: replicated to remaining targets after approval (→ `/apply-pattern`)

If pattern, list the remaining targets.

### Risks & Gaps — what we've accepted or left open

List any acknowledged risks, tentative agreements, and gaps we've agreed to leave. Don't reopen them — acknowledge them.

If the user raises a new concern during this check, pause. Research (Context7, web search, codebase) or discuss to resolve it. Then re-confirm before building.

## Build

Build exactly what was confirmed in the Pre-check. Not a stub — correct structure, behavior, and edge cases handled.

Keep the development environment operational at all times. The user should be able to verify the result at any point.

If scope changes during implementation, confirm with the user before expanding.

## Verify

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

List the specific changes: which files, functions, components were created or modified. Make it clear what the user should check.

「[変更したファイル・関数・コンポーネントの一覧]。この結果を確認してください。次に進んでよいですか？」

- Approved + pattern scope → the agent applies the pattern to remaining targets
- Approved + single scope → next step (user decides)
- Changes needed → return to Build

---
name: pre-check
description: Trigger when a non-trivial change is about to start. Clarify approach, error paths, and test scope before building. Use when the user wants to plan, design, or think through a change first.
compatibility: opencode
---

# Skill: pre-check

Trigger this skill when a unit is non-trivial and the user wants to
think it through before building. Confirms what, why, scope, and
uncertainties — locks them in so the build phase can run without
reopening them.

## When to use

- Touching more than one file
- Introducing new error paths
- Calling library API in a new way
- Changing a public interface (route, type, export)

If none of the above, the unit is trivial — skip this skill and go
straight to the build phase.

## Sections

Use the `question` tool or chat to present the following. Each
section locks in a decision. The user may revisit a section before
moving on.

### What — the unit to build

Name the files, functions, components, endpoints, tables, or
settings as discussed.

| Type          | Specify                                        |
| ------------- | ---------------------------------------------- |
| UI            | component name, file path, behavior            |
| Logic         | function name, file path, input/output shape   |
| State         | state shape, transitions, file path            |
| API           | endpoint, request/response shape, file path    |
| Database      | table, migration, query, file path             |
| Configuration | environment variable, build setting, file path |

### Error paths — what can go wrong

Enumerate the error paths the unit must handle. For each, decide
the response (return early, throw, log, etc.).

The happy path is one where the program returns early from an error
path and returns a result at the end. Error paths are the most
important to cover — happy path is implicit.

### Test scope — what tests will verify

For each error path and the critical happy path, plan a test.

- Error paths: each must have a test
- Critical happy path: at least one test
- Avoid redundant or trivial assertions

### Approach — why this way

Restate the approach and the reason it was chosen over alternatives.
For libraries being touched, consult Context7 MCP to verify the
newest API surface — don't rely on training-time knowledge.

### Scope — single or pattern

- **Single**: one-off, no remaining targets
- **Pattern**: replicated to remaining targets after approval

If pattern, list the remaining targets.

### Risks & Gaps — what we've accepted or left open

List any acknowledged risks, tentative agreements, and gaps we've
agreed to leave. Don't reopen them — acknowledge them.

## Hand off

After all sections are agreed, the agent proceeds to the build
phase. The user can re-trigger this skill at any time to revisit
decisions.

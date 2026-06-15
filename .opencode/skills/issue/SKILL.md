---
name: issue
description: Trigger when the work is substantial enough to track — same condition as creating a new branch in /setup. Manages GitHub Issues as the plan for substantial work. The user ultimately decides whether to create an issue. The agent handles all gh CLI operations.
---

# Issue Management

Issues serve as the plan for substantial work. Use this skill when the work is big enough to warrant a new branch in /setup.

## When to use

- The work spans multiple units
- The work spans multiple sessions
- The work is substantial enough to track and reference later
- The user explicitly asks for an issue

**Skip for:**

- Typo fixes and one-liners
- Single-unit, session-bound work
- Quick changes that don't need tracking

## Principles

- The user decides whether to create an issue. The agent handles creation, updates, and closing via gh CLI.
- The issue is the plan — it captures Goal, Gate, Scope, and Risks & Gaps.
- Avoid over-decomposition. If a task is too large, propose a reasonable breakdown first and ask for user approval.
- Issues serve as session-to-session memory. Always reference the issue number in commits and PR descriptions.

## Format

When creating or suggesting a new issue, use this template. Write content in natural Japanese.

```markdown
## Goal

<What to achieve in 1 sentence.>

## Gate

<What "done" looks like. Verifiable.>

## Scope

- **Single:** <description, or "N/A" if pattern>
- **Pattern:** <remaining targets to apply the same approach, or "N/A" if single>

## Risks & Gaps

- [r1] <known risk or open question>
- [r2] ...

## Plan

- **First unit:** <the single unit to build end-to-end first>
- **Related files:** <list of relevant file paths>
- **Existing patterns:** <components or implementations to reference>
- **Technical constraints:** <any constraints or prerequisites>

## Acceptance Criteria

- [ ] Works as expected
- [ ] Related tests pass (if applicable)
- [ ] Edge cases and error handling considered
- [ ] User has reviewed and confirmed
```

## Commands

Use `gh` CLI for all operations.

### Creating an issue and adding to Project

```bash
ISSUE_URL=$(gh issue create --title "..." --body "..." --json url -q .url)
gh project item-add 1 --owner <username> --url $ISSUE_URL
```

- Always capture the URL at creation time with `--json url -q .url`.
- Always add to Project #1 immediately after creation.

### Other operations

```bash
# Update issue
gh issue edit <number> --title "..." --body "..."

# Close issue
gh issue close <number>

# View issue
gh issue view <number>
```

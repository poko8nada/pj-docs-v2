---
name: issue
description: Manages GitHub Issues using gh CLI — creation, decomposition, update, and close. Load when asked to create a new issue, break down a large task into issues, update issue status, or close an issue after a PR is merged. The user ultimately decides whether to create an issue. The agent handles all gh CLI operations.
---

# Issue Management

## Preparation

- Reload `.opencode/rules/project-meta.mdc` and incorporate it into the context for this skill execution.
- Understand the overall project context, current architecture, and existing code style before proposing or creating issues.
- Verify project scope is enabled: `gh auth status`. If the `project` scope is missing, run `gh auth refresh -s project` before proceeding.

## Principles

- The user decides whether to create an issue. The agent handles creation, updates, and closing via gh CLI.
- Prioritize meaningful scope over strict "1 issue = 1 PR". One issue should represent a coherent piece of work that feels natural to complete in one (or a small number of) PR(s).
- Avoid over-decomposition. If a task is too large to finish comfortably in one PR, propose a reasonable breakdown first and ask for user approval before creating multiple issues.
- Issues serve as session-to-session memory and future reference. Always reference the issue number in commits and PR descriptions (e.g., `Closes #123` or `#123`).

## Granularity Guide

**Good scope (recommended for most cases)**

- Add or improve a specific feature / component with related changes and tests
- Fix a specific bug (including reproduction steps and verification)
- Refactor a specific module or area without changing behavior
- Update documentation or configuration for one clear purpose

**Too large — propose decomposition first**

- "Implement full authentication" → break into login flow, session management, token handling, error cases, etc.
- "Redesign the entire dashboard" → break into UI components, data fetching, state management, responsiveness, etc.

When the requested task is clearly large, list the proposed decomposed issues for user confirmation before creating them.

## Commands

Use `gh` CLI for all operations.

### Creating an issue and adding to Project

```bash
ISSUE_URL=$(gh issue create --title "..." --body "..." --json url -q .url)
gh project item-add 1 --owner <username> --url $ISSUE_URL
```

- Always capture the URL at creation time with `--json url -q .url`.
- Always add to Project #1 immediately after creation — no confirmation needed.
- Retrieve `--owner` from `project-meta.mdc`.

### Other operations

```bash
# Update issue
gh issue edit <number> --title "..." --body "..."

# Close issue
gh issue close <number>

# View issue
gh issue view <number>
```

## Format

Use the following Markdown template when creating or suggesting a new issue. Write the content in **natural Japanese**.

```markdown
## 背景・目的 (why)

<Briefly describe the reason and context for this change in 1–3 sentences.>

## やること (what)

<List the specific tasks in bullet points. Include relevant files and considerations. Summarize the scope so it fits naturally within a single PR.>

## 実行条件 (plan)

- **First unit:** [The single unit to build end-to-end first — fully working and verifiable by the user]
- **Apply pattern:** [List of remaining targets to apply the same approach after first unit is approved]
- **Skills:** [implement-ui / implement-logic / implement-state / implement-api / implement-db / implement-test / implement-config / debug]
- **Related files:** [List of relevant file paths]
- **Existing patterns:** [Components or implementations to reference]
- **Technical constraints:** [Any constraints or prerequisites]

## 受け入れ条件 (Acceptance Criteria)

- [ ] Works as expected
- [ ] Related tests pass (if applicable)
- [ ] Edge cases and error handling considered
- [ ] User has reviewed and confirmed

## Notes

<Design decisions, items to review later, related issues, or anything to keep in mind. Leave blank if nothing to note.>
```

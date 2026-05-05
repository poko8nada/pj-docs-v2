---
name: issue
description: Manages GitHub Issues using gh CLI — creation, decomposition, update, and close. Load when asked to create a new issue, break down a large task into issues, update issue status, or close an issue after a PR is merged. The user ultimately decides whether to create an issue. The agent handles all gh CLI operations.
---

# Issue Management

## Preparation

- Reload `.cursor/rules/project-meta.mdc` and incorporate it into the context for this skill execution.
- Understand the overall project context, current architecture, and existing code style before proposing or creating issues.

## Principle

- The user decides whether to create an issue. The agent handles creation, updates, and closing via gh CLI.
- Prioritize meaningful scope over strict "1 issue = 1 PR". One issue should represent a coherent piece of work that feels natural to complete in one (or a small number of) PR(s).
- Avoid over-decomposition. If a task is too large to finish comfortably in one PR, propose a reasonable breakdown first and ask for user approval before creating multiple issues.
- Issues serve as session-to-session memory and future reference. Always reference the issue number in commits and PR descriptions (e.g., Closes #123 or #123).

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

Use the existing `gh-cli` skill (available at user/global level) for all operations: creating, updating, closing, and linking issues.

### Adding issues to the Project after creation

After creating an issue, **always** add it to Project #1 immediately — no need to confirm with the user.

```bash
# Capture the URL at creation time
ISSUE_URL=$(gh issue create --title "..." --body "..." --json url -q .url)

# Add to Project #1 (get the owner username from project-meta.mdc)
gh project item-add 1 --owner <username> --url $ISSUE_URL
```

- Always pass `--json url -q .url` to `gh issue create` to capture the URL into a variable.
- Run `gh project item-add` right after creation, without asking the user.
- Retrieve the `--owner` value from `project-meta.mdc`.

## Format

Use the following Markdown template when creating or suggesting a new issue. Write the content in **natural Japanese**.

```Markdown
## 背景・目的 (why)

<briefly describe the reasons and background for this change in 1 to 3 sentences.>

## やること (what)

<list the specific tasks to be performed in this issue (and the corresponding PR) in bullet points.You may include relevant files and considerations.Summarize the scope so that it fits naturally within a single PR.>

## 受け入れ条件 (Acceptance Criteria)

- [ ] <confirmed that it works as expected>
- [ ] <related tests have passed (if applicable)>
- [ ] <edge cases and error handling have been taken into account>
- [ ] <the user have reviewed it himself and confirmed that it is in good working order>

## Notes

<Feel free to note any design decisions, items to review later, related issues, or points to keep in mind. (If there is nothing to note, leave this section blank.)>
```

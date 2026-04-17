---
name: issue
description: Manages GitHub Issues using gh CLI — creation, decomposition, update, and close. Load when asked to create a new issue, break down a large task into issues, update issue status, or close an issue after a PR is merged. User decides whether to create an issue. Agent handles all gh CLI operations.
---

# Issue Management

## Principle

- If the intent is unclear, discuss it with the user so that you can write it in the format below.
- User decides whether to create. Agent handles creation, updates, and closing.
- 1 Issue = 1 PR — scope each issue to what can be completed in a single PR.
- Issues are the session-to-session bridge — always reference the issue number in commits and PRs.

## Granularity Guide

**Good scope**

- Add a specific feature function with tests
- Fix a specific bug
- Refactor a specific module

**Too large — decompose first**

- "Implement authentication" → break into: session management, login flow, token refresh, etc.
- "Redesign dashboard" → break into individual components or data-fetching concerns

When asked to implement something large, list the decomposed Issues for human approval before creating them.

## Commands

- You already have `gh-cli` skill in user level (global). Use it to create, update, and close issues.

## Format

Use this template for issues.

```Markdown
## Why

<one sentence in Japanese>

## What

<bullets scoped to one PR in Japanese>

## Done when

- [ ] <criteria in Japanese>

## Notes

<decisions or discussion summary in Japanese — omit if empty>
```

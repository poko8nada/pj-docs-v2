---
name: issue
description: "Manage substantial work using Spec + Task issues. One Spec holds the product design, Task issues are carved out per work unit and closed after completion. Use when the work spans multiple sessions or units, or when the user asks to create an issue. Skip for single-unit, session-bound work."
---

# issue

Manage issues using a Spec + Task base. One Spec holds the product design for a feature area. Task issues are carved out per work unit and closed after completion.

## Principles

- The user decides whether to create an issue. The agent handles creation, updates, and closing via gh CLI.
- **Spec** — The product design for one feature area. Holds the abstract Goal, Scope, Architecture, and decisions. Rarely changes; only updated when Goal / Scope / Architecture shifts.
- **Task issue** — One work unit carved out from the Spec. Created just-in-time, closed after completion. Disposable.
- **Comments** — The living work log. Every Spec update, Task creation, and Task close requires a comment with the reason or summary.
- Do not write detailed task checklists in the Spec body. They get stale. Use comments instead.
- Issues serve as session-to-session memory. Always reference the issue number in commits and PR descriptions.
- **Update Spec body** — Only when Goal / Scope / Architecture changes. After updating, record the change and its reason in a comment. Do not update Spec body on Task completion.

## Comment rules (required)

Every lifecycle event must produce a comment. The comment is the work log.

| Event        | Target | Comment format                           |
| ------------ | ------ | ---------------------------------------- |
| Spec created | -      | (no comment — creation body is enough)   |
| Spec updated | Spec   | `## 更新: <what changed>\n<why>`         |
| Task created | Spec   | `## Task 切り出し: <Task title>\n<what>` |
| Task updated | Task   | `## 進捗: <Task title>\n<current state>` |
| Task closed  | Spec   | `## 完了: <Task title>\n<what was done>` |

`gh` CLI examples:

```bash
# Spec update
gh issue comment <spec_number> --body "## 更新: <what changed>\n<why>"

# Task creation (comment on Spec)
gh issue comment <spec_number> --body "## Task 切り出し: <Task title>\n<what>"

# Task progress (comment on Task)
gh issue comment <task_number> --body "## 進捗: <Task title>\n<current state>"

# Task close (comment on Spec)
gh issue comment <spec_number> --body "## 完了: <Task title>\n<what was done>"
gh issue close <task_number>
```

## Spec template

Use this template for the Spec body.

```markdown
## What is this product?

<どんなプロダクトか 1 文で>

## Features

- 機能 1
- 機能 2

## Non-goals

- 対象外 1
- 対象外 2

## Stack

| Area | Choice | Reason |
| ---- | ------ | ------ |
| ...  | ...    | ...    |

## Roadmap

- **v1**: ...
- **v2**: ...

## Open Questions

- [ ] 未解決事項 1
- [ ] 未解決事項 2
```

## Task template

Carve out a Task issue when starting work. The Task mirrors the structure used in the `plan` skill so the agent can plan and execute consistently.

```markdown
## Goal

<このユニットで何をやるか>

## Gate

<完了条件。検証可能に>

## What

<何を実装するか>

## How

<どうやって実装するか>

## Order

<どの順に実装するか — 垂直スライスで叩き台から>

## Verify

<どう検証するか — test pass + ユーザーがアプリ動かして確認>
```

## Title convention

- Spec: `[Spec] <product / feature area name>` (one per project)
- Task: `[Task] <what this unit achieves>`

## Workflow

### 1. Create Spec

Create a Spec when starting a new product or feature area.

```bash
ISSUE_URL=$(gh issue create --title "[Spec] ..." --body "...")
gh project item-add 1 --owner <username> --url $ISSUE_URL
```

### 2. Carve out Task issue

When starting work, create a Task issue and comment on the Spec.

```bash
ISSUE_URL=$(gh issue create --title "[Task] ..." --body "...")
gh project item-add 1 --owner <username> --url $ISSUE_URL
gh issue comment <spec_number> --body "## Task 切り出し: <Task title>\n<what>"
```

### 3. Update Task progress

During work, comment progress on the Task itself.

```bash
gh issue comment <task_number> --body "## 進捗: <Task title>\n<current state>"
```

### 4. Complete work

Close the Task and record the result in the Spec.

```bash
gh issue close <task_number>
gh issue comment <spec_number> --body "## 完了: <Task title>\n<what was done>"
```

### 5. Repeat

Repeat steps 2-4. The Spec comments become a natural work log.

## Commands

Use `gh` CLI for all operations.

```bash
# Spec / Task 作成
ISSUE_URL=$(gh issue create --title "..." --body "...")
gh project item-add 1 --owner <username> --url $ISSUE_URL

# Issue にコメント
gh issue comment <number> --body "..."

# Task issue を close
gh issue close <number>

# Issue 一覧
gh issue list --state open --limit 10

# Issue 確認
gh issue view <number>
```

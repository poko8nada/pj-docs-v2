# Commands

Use `gh` CLI for all operations.

## Spec / Phase issue creation

```bash
ISSUE_URL=$(gh issue create --title "..." --body "...")
gh project item-add 1 --owner <username> --url $ISSUE_URL
```

## Comment on issue

```bash
gh issue comment <number> --body "..."
```

## Close issue

```bash
gh issue close <number>
```

## List issues

```bash
gh issue list --state open --limit 10
```

## View issue

```bash
gh issue view <number>
```

## Comment examples

```bash
# Spec update
gh issue comment <spec_number> --body "## 更新: <what changed>\n<why>"

# Design creation (comment on Spec)
gh issue comment <spec_number> --body "## Design作成: <title>\n<what>"

# Design update (comment on Design issue)
gh issue comment <design_number> --body "## 更新: <what changed>\n<why>"

# Design progress (comment on Design issue)
gh issue comment <design_number> --body "## 進捗: <current state>"

# Design complete (comment on Spec + close Design issue)
gh issue comment <spec_number> --body "## Design完了: <title>\n<what was done>"
gh issue close <design_number>

# Build creation (comment on Spec)
gh issue comment <spec_number> --body "## Build作成: <title>\n<what>"

# Build update (comment on Build issue)
gh issue comment <build_number> --body "## 更新: <what changed>\n<why>"

# Build progress (comment on Build issue)
gh issue comment <build_number> --body "## 進捗: <current state>"

# Build complete (comment on Spec + close Build issue)
gh issue comment <spec_number> --body "## Build完了: <title>\n<what was done>"
gh issue close <build_number>

# Refine creation (comment on Spec)
gh issue comment <spec_number> --body "## Refine作成: <title>\n<what>"

# Refine update (comment on Refine issue)
gh issue comment <refine_number> --body "## 更新: <what changed>\n<why>"

# Refine progress (comment on Refine issue)
gh issue comment <refine_number> --body "## 進捗: <current state>"

# Refine complete (comment on Spec + close Refine issue)
gh issue comment <spec_number> --body "## Refine完了: <title>\n<what was done>"
gh issue close <refine_number>
```

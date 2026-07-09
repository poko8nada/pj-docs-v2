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

## Edit issue body (for Design spec body updates)

The design spec is stored directly in the [Design] issue body and updated as the design conversation evolves. The LLM keeps the body up to date throughout the design phase.

Pass the full body via `--body` with a heredoc. The heredoc keeps multi-line markdown intact without temp files or path concerns.

```bash
gh issue edit <design_number> --body "$(cat <<'EOF'
## Goal
<this unit's goal>

## Reference
- Spec: #<spec_number>

## Style Guide
### Color
| Token | Value | Use |
| Brand | #3B82F6 | primary CTA |

## Component Matrix
| Component | Props | State | TODO |
| Header   | siteName, nav | - | - |
EOF
)"
```

To read the body (used by the build phase to fetch the spec):

```bash
gh issue view <design_number> --json body | jq -r '.body'
```

## Edit issue body (for Build / Refine progress updates)

The Build / Refine Progress section lives at the bottom of the issue body. After each `[run]` invocation (or STOP), update the section to mark completed stages and append a note. The same heredoc pattern as Design applies.

```bash
gh issue edit <build_number> --body "$(cat <<'EOF'
... existing body content ...

# Build Progress

## Stages

- [x] Stage 1: <done>
- [ ] Stage 2: <next>

## Notes

- Stage 1: <one-line summary>
EOF
)"

# Refine (same pattern, with impact tier labels)
gh issue edit <refine_number> --body "$(cat <<'EOF'
... existing body content ...

# Refine Progress

## Stages (by impact tier)

- [x] **High**: <done>
- [ ] **Medium**: <next>

## Notes

- High tier: <one-line summary>
EOF
)"
```

Pair each `gh issue edit` call with a `## 進捗:` comment on the same issue — the comment is the event log, the body edit is the structured record.

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

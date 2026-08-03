---
name: issue
description: >-
  Persists agreed Goal / Discover / Build decisions and soft results in GitHub so product state and findings remain traceable. Use when creating, updating, or closing those issues or refreshing `## soft: …` comments. Do not use for unresolved discussion, research output, product file edits, or chore-only work unless explicitly requested.
---

# issue

Templates, titles, soft comments, and `gh` writes. Callers supply agreement and content.

## Produces

- A created, updated, or closed issue or an in-place `## soft: …` comment pointing to `findings/`.

## Steps

1. Know the operation: create / update body / soft comment / close.
2. Unclear what/why/title → agree in chat first (`scope` if session direction is unsettled). Content already agreed → skip that chat.
3. Execute matching template: `references/goal-template.md` | `discover-template.md` | `build-template.md`.
4. Apply agreed content (overview / why / agreed only — no Research/HTML/matrices in bodies).
5. Soft run → update soft comment in place (below).
6. Run `gh`. Return issue number + what changed.

### Soft comments

On the issue the soft informs:

1. Find comment starting with `## soft: <name>` → edit in place; else create one. Do not stack duplicates.

```markdown
## soft: <name>

- Topic: …
- Path: findings/<name>/…
- Why: …
- Summary: …
- Axes touched: …
```

| Field        | How                           |
| ------------ | ----------------------------- |
| Topic        | One line                      |
| Path         | `findings/<name>/…`           |
| Why          | 1–3 bullets                   |
| Summary      | ≤3 lines; omit if empty       |
| Axes touched | Comma-separated; omit if none |

### Titles

- `[Goal] <product>` / `[Discover] <product>` / `[Build] <what this build achieves>`

### Body write

```bash
gh issue edit <number> --body "$(cat <<'EOF'
…full body…
EOF
)"
```

Fallback: scratch under `.cursor/tmp/`, delete after success.

## Limits

- Body = judgment only. Concrete soft results stay in `findings/`.
- One Goal, one Discover per product; one open Build at a time.
- Do not invent product work or re-argue decisions.
- Soft investigation and product file edits are not this skill.

## Handoff

- `scope` when session direction is unsettled, soft skills for investigation, and `rules` for product file edits.

---
name: issue
description: >-
  Persist this project's product-state GitHub issues — Goal (covenant), Discover (provisional axes), and Build (MVP/Next delivery axes).
  Bodies hold judgment only (overview, why, agreed); concrete soft results live under findings/.
  Create, update, or close those issues, and keep one soft comment per soft skill updated in place.
  Use when working with [Goal]/[Discover]/[Build] issues, locking axis decisions, or pointing soft: comments at findings/.
---

# issue

Persist product-state issues. Callers decide _when_ and _what content_; this skill owns **templates, titles, soft comments, create / update / close**.

Do **not** invent product work or re-argue decisions here. If the caller already has user agreement and body content, apply the template and write.

## When called

**From a phase skill (usual):** agreement and content are already settled. Skip scope chat. Read the matching template → create or update → soft comments as needed.

**Standalone / unclear:** agree in chat what issue, why now, and title (brief — call `scope` when session direction is unsettled). Revise until agreed, then proceed.

**Chore:** only create/update when the user asks.

## What you own

- Title convention
- Body shape via templates under `references/`
- Soft comments (`## soft: <name>` — one per soft per issue, **update in place**)
- `gh` create / edit / comment / close / list / view (use `gh-cli` skill when unsure)

## What you do not own

- Phase entry or “what should we do this session?” — `discussion` / `scope` / `work`
- Soft investigation itself — soft skills write `findings/` and return; this skill only persists the comment pointer
- Product / harness file edits — `rules` via the caller

## Principles

- **Body** = judgment axes: overview + why + `- [ ] agreed`. Follow each template’s How to write. Not full Research, HTML, matrices, or token dumps.
- **`findings/`** = concrete soft results (append-only; committed with the project).
- **Goal** — one per product. Covenant (What is this / Goal / Non-goal). After agreed, change only for redefinition.
- **Discover** — one per product. Provisional axes (Name / Look / Stack / Features). No version rows; MVP / Next live on Build Roadmap. Ready for Build = all Discover sections agreed.
- **Build** — one open at a time. Roadmap defines MVP / Next; Test strategy and Deploy follow those rows. No Plan section in the body.
- **Create thin, fill as you go** — create with empty sections; fill when axes are agreed.

## Soft comments

On the issue that the soft informs (usually Discover or Build):

1. List comments; find one whose body starts with `## soft: <name>` (same name).
2. If found → **edit** that comment. If not → create one.
3. Do **not** stack a new soft comment every run.

### Shape

```markdown
## soft: <name>

- Topic: …
- Path: findings/<name>/…
- Why: …
- Summary: …
- Axes touched: …
```

### How to write

| Field        | How                                                          |
| ------------ | ------------------------------------------------------------ |
| Topic        | One line                                                     |
| Path         | One line (`findings/<name>/…`)                               |
| Why          | 1–3 bullets (required)                                       |
| Summary      | At most 3 lines; omit if nothing useful                      |
| Axes touched | One line, comma-separated (e.g. `Look, Stack`); omit if none |

Full dumps stay in `Path`. Do not paste Research, HTML, or long audits into the comment.

## Title convention

- Goal: `[Goal] <product>`
- Discover: `[Discover] <product>`
- Build: `[Build] <what this build achieves>`

## Flow

1. Know the operation: create / update body / soft comment / close.
2. Read the matching template (`goal` / `discover` / `build`).
3. Apply agreed content into the template shape (and its How to write).
4. Run `gh`. Soft runs → update soft comment.
5. Return issue number + what changed to the caller.

## Body write (gh)

Prefer heredoc — stay inside the workspace root:

```bash
gh issue edit <number> --body "$(cat <<'EOF'
…full body…
EOF
)"
```

If that fails, use a scratch file under `.cursor/tmp/` (gitignored), then delete it after success.

## References

- `references/goal-template.md`
- `references/discover-template.md`
- `references/build-template.md`

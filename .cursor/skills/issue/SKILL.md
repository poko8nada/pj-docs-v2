---
name: issue
description: >-
  Create, update, transition, or close Spec / Design / Forge / Refine issues.
  Use when a phase skill (or the user) needs issue persistence — templates and lifecycle live here.
---

# issue

Persist Spec-flow issues. Phase skills decide _when_ and _what content_; this skill owns **templates, titles, comments, create / update / close**.

Do **not** invent phase work or re-argue the plan here. If the caller already has user agreement and body content, apply the template and write.

## When called

**From a phase skill (usual):** agreement and content are already settled. Skip Context / Understanding / Proposal. Read the matching template → create or update → post the required lifecycle comment.

**Standalone / unclear:** present **Context / Understanding / Proposal** in one message (what issue, why now, title). Revise until agreed, then proceed.

**Chore:** no Spec-flow issue is required. Only create/update when the user asks or a small lifecycle note is clearly needed — do not open Design / Forge / Refine for typo or harness tweaks.

## What you own

- Title convention
- Body shape via templates under `references/`
- Lifecycle comments (table below)
- `gh` create / edit / comment / close / list / view (use `gh-cli` skill for command shape when unsure)

## What you do not own

- Phase entry, mode choice (①/②), or “should we Spec?” — that is the phase skill
- How to write a Forge/Refine plan — `.cursor/skills/forge|refine/references/plan.md`
- How to build the Design thinking surface — `design/references/app.md` / `web.md`
- Product edits — never; hand that to `rules` via the phase skill

## Principles

- **Spec** — thick product design (Goal / Scope / Architecture / decisions). One per project or version. Update body only when those shift; record why in a Spec comment.
- **Phase issues** — Design / Forge / Refine are just-in-time; close when the phase work for that issue is done. Reference prior phase issue(s) and the codebase in the body.
- **Create thin, fill as you go** — on create, body is the template with empty sections. Content is filled as the phase agrees (`# Grain` / `# Tokens` / `# Screen` for Design, Forge/Refine Plan, slice checkboxes).
- **Body is source of truth** for the phase’s durable output. Drift between body and agreed work is a failure mode.
- **Comments** — living work log for lifecycle and material updates (see table). Issues are session-to-session memory; cite issue numbers in commits / PRs.

## Comment rules (required)

| Event           | Target       | Comment format                            |
| --------------- | ------------ | ----------------------------------------- |
| Spec created    | —            | (no comment — creation body is enough)    |
| Spec updated    | Spec         | `## 更新: <what changed>\n<why>`          |
| Design created  | Spec         | `## Design作成: <title>\n<what>`          |
| Design updated  | Design issue | `## 更新: <what changed>\n<why>`          |
| Design complete | Spec         | `## Design完了: <title>\n<what was done>` |
| Forge created   | Spec         | `## Forge作成: <title>\n<what>`           |
| Forge updated   | Forge issue  | `## 更新: <what changed>\n<why>`          |
| Forge complete  | Spec         | `## Forge完了: <title>\n<what was done>`  |
| Refine created  | Spec         | `## Refine作成: <title>\n<what>`          |
| Refine updated  | Refine issue | `## 更新: <what changed>\n<why>`          |
| Refine complete | Spec         | `## Refine完了: <title>\n<what was done>` |

When creating a phase issue, the body must reference:

- Prior phase issue body (and material comments when relevant)
- Current codebase state (paths / patterns that matter)

## Title convention

- Spec: `[Spec] <product / feature area name>`
- Design: `[Design] <what this design achieves>`
- Forge: `[Forge] <what this forge achieves>`
- Refine: `[Refine] <what this refine achieves>`

## Flow

1. Know the operation: create / update body / lifecycle comment / close.
2. Pick the template (Design: app vs web from project type — caller usually already chose).
3. Apply agreed content into the template shape. Do not rewrite a locked Forge/Refine plan into a different structure.
4. Run `gh`. On create of Design / Forge / Refine, also comment on Spec per the table. On phase complete, close the phase issue and comment on Spec.
5. Return issue number + what changed to the caller.

## Body write (gh)

Prefer heredoc — stay inside the workspace root (no `/tmp`, no paths outside the project):

```bash
gh issue edit <number> --body "$(cat <<'EOF'
…full body…
EOF
)"
```

If that fails (body too large, shell quoting), use a scratch file under `.cursor/tmp/` (gitignored):

1. Write `.cursor/tmp/issue-<number>-body.md`
2. `gh issue edit <number> --body-file .cursor/tmp/issue-<number>-body.md` (or `gh issue create --body-file …`)
3. Delete the scratch file after `gh` succeeds

Do not leave drafts in the repo root or other tracked paths.

## References

- `references/spec-template.md`
- `references/design-app-template.md`
- `references/design-web-template.md`
- `references/forge-template.md`
- `references/refine-template.md`

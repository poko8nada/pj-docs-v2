# agenda — Chore

Use this reference when a `/chore` concern needs more than one implementation step.
Chore is selected by subject, not size: use the same slice/task model for
non-product harness, meta, tooling, documentation, or non-functional
product-adjacent maintenance work.

## Context sources

- The confirmed session focus and bounded chore concern
- The touch list and relevant existing Skill, hook, or document
- Existing smoke commands or other concrete checks

## What this situation does

- Keep one bounded concern; the concern may include multiple slices and files.
- Skip this agenda for a small, direct chore.
- Identify the task edges before writing sequence.
- Describe the expected surface, not only the files to edit. Product files may
  be in scope when the change is non-functional, such as a typo or copy fix.
- Stop after the task table until the user agrees to the whole agenda or next task.
- Hand off to `rules` before edits.

## Format

```markdown
| #   | What      | Includes          | Test        | Surface          |
| --- | --------- | ----------------- | ----------- | ---------------- |
| 1   | one slice | work + validation | command/N/A | expected outcome |
```

- **What** — one slice or task within the bounded concern.
- **Includes** — relevant work, dependencies, and task edges.
- **Test** — a concrete command, or `N/A` with a reason for documentation-only work.
- **Surface** — the observable harness, product-copy, document, or tooling result.

## Limits

- Do not turn a chore into Goal / Discover / Build product behavior, capability,
  or contract work.
- Do not create or update Issues from this agenda.
- Do not treat the agenda as an edit permission or a replacement for `scope` / `rules`.
- Do not open a separate `unlock.agenda` gate for chore planning.

Handoff: `rules` → execute the agreed bounded task.

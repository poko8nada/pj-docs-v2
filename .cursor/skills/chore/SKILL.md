---
name: chore
description: >-
  This is one of the project phases.
  Use when entering Chore: small scoped changes (typo, harness, meta) with no plan issue required.
disable-model-invocation: true
---

# chore

Small, bounded changes only: typos, harness tweaks, meta fixes. **No plan issue required.** Not for product design, forge/refine slice work, or growing a feature.

## On entry

Inspect the repo (and issues only if relevant). Then present **Context / Understanding / Proposal** in one message — exact scope you intend to touch, not a question dump.

Typical states (use as anchors in Understanding):

- Request is clearly tiny (typo, harness, meta) → propose **that exact scope**, then edit after agreement
- Request is actually Spec / Design / Forge / Refine work → say so; do not stretch Chore — user invokes the right phase skill
- Scope starts creeping mid-work → **stop**, restate Understanding / Proposal, or ask the user to switch phase

Revise until the user agrees the scope. Do not start editing on a vague “fix stuff”.

## Flow

1. Keep the change to **one concern**. No slice planning.
2. Before any code or harness file edit, Read `.cursor/skills/rules/SKILL.md` to obtain permission to edit, then follow `rules`.
3. Issue create/update is optional. If you touch issues, use `issue` skill.

Hand off to `issue` / `rules` by name — do not copy their contents here.

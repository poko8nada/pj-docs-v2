---
name: chore
description: >-
  Small scoped session phase for typos, harness/meta fixes, and other light unrelated edits.
  Use when entering /chore; not for Goal/Discover/Build product tracks (use /work) or deciding session direction (use discussion).
disable-model-invocation: true
---

# chore

Small, bounded changes only: typos, harness tweaks, meta fixes, and other light edits. **No Goal / Discover / Build track required.** Not for growing Discover/Build product work — that is `/work`.

## On entry

Inspect the repo (and issues only if relevant). Then present **Context / Understanding / Proposal** in one message — exact scope you intend to touch, not a question dump.

Typical anchors:

- Request is clearly tiny (typo, harness, meta, light fix) → propose **that exact scope**, then edit after agreement
- Request is actually Goal / Discover / Build product work → say so; user invokes `/work` (or `/discussion` first)
- Scope starts creeping mid-work → **stop**, restate Understanding / Proposal, or ask the user to switch phase

Revise until the user agrees the scope. Do not start editing on a vague “fix stuff”.

## Flow

1. Keep the change to **one concern**.
2. Before any code or harness file edit, Read `.cursor/skills/rules/SKILL.md`, then follow `rules`.
3. Issue create/update only when the user asks or a tiny note is clearly needed — use `issue` skill.

Hand off to `issue` / `rules` by name — do not copy their contents here.

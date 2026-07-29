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

Inspect the repo (and issues only if relevant).

- **Scope clear** from the user (files named, `/chore` with a concrete ask) → Read `scope` (thin Theme is fine), state the exact touch list briefly, then edit after `rules` handshake.
- **Scope unclear** → Read `scope` and agree Theme / In / Out in chat before editing. Not a question dump.
- **Actually product work** → say so; user invokes `/work` (or `/discussion` first).
- **Scope creeps mid-work** → stop, restate the agreed touch list, or ask the user to switch phase (`/discussion` closes harness scope).

Harness: edits need `unlock.scope` (Read `.cursor/skills/scope/SKILL.md`) **before** `unlock.rules`. `/discussion` closes scope. **`unlock.plan` is null here** — product planning is `/work` only.

Revise until the user agrees the scope. Do not start editing on a vague “fix stuff”.

## Flow

1. Keep the change to **one concern**.
2. Read `.cursor/skills/scope/SKILL.md` if scope is not open; agree Theme (and label when stable).
3. Before any code or harness file edit, Read `.cursor/skills/rules/SKILL.md`, then follow `rules`.
4. Issue create/update only when the user asks or a tiny note is clearly needed — use `issue` skill.

Hand off to `scope` / `issue` / `rules` by name — do not copy their contents here.

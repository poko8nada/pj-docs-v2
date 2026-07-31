---
name: notes
description: >-
  Write, resolve, or commit-check inline NOTE: comments in code.
  Use when leaving a NOTE, addressing NOTEs, or before git commit if NOTE lines may have been removed.
---

# notes

Pick **exactly one** mode. Persistent design context → issues, not NOTE.

## Format

```ts
// NOTE: one line — what to fix, what's missing, or context for the next session
```

One line, next to code. No priority/author/`[done]` — resolved notes are deleted.

## Steps — Write

1. Add one `NOTE:` near the relevant code.
2. Do not implement unless also asked — hand off `rules`.

## Steps — Resolve

1. Collect: `rg -n 'NOTE:' . --glob '!.cursor/skills/**' --glob '!node_modules/**' --glob '!.git/**'`
2. Propose one block per note — no edits until user agrees.
3. Edit via `rules`.
4. Delete resolved `NOTE:` only after user confirms changes.
5. Run Commit check before `git commit`.

## Steps — Commit check

Before `git commit`:

```bash
node .cursor/skills/notes/scripts/list-removed.mjs
```

- Exit 0 / no output → commit.
- Lists removed lines → show user; wait for OK before commit.

## Limits

- Do not run Write + Resolve + Commit check as one flow unless Resolve ends in Commit check.
- Do not duplicate `rules` — hand off for code.
- pre-push blocks while any `NOTE:` remains (excluding `.cursor/skills/`).

Hand off: `rules`.

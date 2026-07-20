---
name: notes
description: >-
  Manage inline NOTE comments in code — write context, resolve pending items, or verify removed
  notes before commit. Use when the user asks to leave a NOTE, address NOTEs, or before git commit
  when NOTE lines may have been deleted.
---

# notes

Inline `NOTE:` comments capture work left in the codebase (user or agent). **Persistent design context belongs in issues** — not in NOTE.

**On entry: pick exactly one mode below.** Do not run Write + Resolve + Commit check as a single flow unless Resolve naturally ends in Commit check.

## Format

```ts
// NOTE: one line — what to fix, what's missing, or context for the next session
```

- One line per note, next to relevant code (or document line)
- No priority, no author tag, no `[done]` marker — resolved notes are **deleted**

## Mode — Write

**When:** user asks to memo / leave a NOTE; you need a breadcrumb for a later session.

1. Add a single `NOTE:` line near the relevant code.
2. Do not implement unless the user also asked for that (hand off to the work phase + `rules`).

## Mode — Resolve

**When:** user asks to address NOTEs; pending `NOTE:` items need implementation.

1. Collect pending notes:

   ```bash
   rg -n 'NOTE:' . --glob '!.cursor/skills/**' --glob '!node_modules/**' --glob '!.git/**'
   ```

2. **Analyze & propose** — one block per note (context, understanding, proposal). No file edits until the user agrees.
3. **Edit** — work phase + Read `rules/SKILL.md`, then apply agreed changes.
4. **Delete** resolved `NOTE:` lines after the user confirms the changes (not before).
5. Run **Commit check** (below) before `git commit`.

## Commit check (subroutine — not a separate user invocation)

**When:** `git add` is done and you are about to `git commit` (Resolve end, or `rules` / `chore` committing).

```bash
node .cursor/skills/notes/scripts/list-removed.mjs
```

- **Exit 0 / no output** → proceed with commit.
- **Lists removed NOTE lines** → show the user every removed line (file, line, text). **Wait for explicit OK** before `git commit`. If not OK, restore or fix first.

Do not invoke Resolve for Commit check alone.

## Boundaries

- Do not duplicate `rules` edit rules — hand off to `rules` for code.
- `lefthook` **pre-push** blocks push while any `NOTE:` remains in the repo (excluding `.cursor/skills/` docs). All pending notes must be resolved or removed before push.

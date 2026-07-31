---
name: work
description: >-
  Hands-on for Goal / Discover / Build: scope if needed → agenda → execute → commit.
  Use when the user invokes /work. Not for session direction (discussion) or harness/meta (chore).
disable-model-invocation: true
---

# work

Execute the focus locked by `scope`. Judgment in Goal / Discover / Build issues; soft output in `findings/`.

## Steps

```text
scope (if not open) → agenda (inventory → slices → agree) → Execute → Commit
                                                         → Issue update when needed
```

1. If `unlock.scope` is not true → run `scope`. Unclear → `scope` or name `/discussion`.
2. Run `agenda` + matching `agenda/references/*` (Goal/Discover or Build). Stop after first agenda dump until user agrees.
3. Before edits → `rules` + matching `rules/references/*`.
4. Issue create/update → `issue` + matching template.
5. Execute agreed slice. Softs only from this phase (or the user) — not from other softs.
6. Direction change mid-session → name `/discussion`. Meta/harness → name `/chore`.

Edits need `unlock.scope` → `unlock.agenda` → `unlock.rules`. Running a skill unlocks via Read — still **execute** its procedure.

## Limits

- Do not self-invoke `/discussion` or `/chore` — name them.
- Do not dump Research / HTML / matrices into issue bodies — `findings/` only.
- Do not skip agenda agreement before execute.
- Do not treat Build issue as a durable slice list — slices stay in chat via `agenda`.

Hand off: `scope` / `agenda` / `issue` / `rules` / soft skills.

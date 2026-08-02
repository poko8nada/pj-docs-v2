---
name: work
description: >-
  Hands-on for Goal / Discover / Build: user-confirmed scope → agenda → execute → commit.
  Use when the user invokes /work. Not for session direction (discussion) or harness/meta (chore).
disable-model-invocation: true
---

# work

Execute the focus confirmed by the user through `scope`. Judgment in Goal / Discover / Build issues; soft output in `findings/`.

## Steps

```text
user-confirmed scope → agenda (context scan → slices → agree) → Execute → Commit
                                                         → Issue update when needed
```

1. If `unlock.scope` is not true, do not start work or run `scope` from this phase. Name `/discussion` and wait for the user to confirm the focus with `/scope ok`. If the focus is unclear while discussing, use `scope` or name `/discussion`.
2. Run `agenda` + matching `agenda/references/*` (Goal/Discover or Build). Stop after first agenda dump until user agrees.
3. Before edits → `rules` + matching `rules/references/*`.
4. Issue create/update → `issue` + matching template.
5. Execute agreed slice. Softs only from this phase (or the user) — not from other softs.
6. Direction change mid-session → name `/discussion`. Meta/harness → name `/chore`.

Edits need user-confirmed `unlock.scope` → `unlock.agenda` → `unlock.rules`. Reading a skill unlocks its gate where specified — still **execute** its procedure.

## Limits

- Do not self-invoke `/discussion` or `/chore` — name them.
- Do not dump Research / HTML / matrices into issue bodies — `findings/` only.
- Do not skip agenda agreement before execute.
- Do not treat Build issue as a durable slice list — slices stay in chat via `agenda`.

Hand off: `scope` / `agenda` / `issue` / `rules` / soft skills.

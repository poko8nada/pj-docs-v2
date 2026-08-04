---
name: work
description: >-
  Executes Goal / Discover / Build product work in agreed slices so product changes remain traceable. Use when the user invokes `/work` for product behavior, capability, interaction, data/API, or track work. Do not use for session direction (`discussion`) or harness/meta maintenance (`chore`); unlock.scope gates edits, not phase handoff.
disable-model-invocation: true
---

# work

Execute the focus handed off by the user. Scope gates edits; judgment belongs in Goal / Discover / Build issues, and soft output belongs in `findings/`.

## Steps

```text
user handoff → agenda (context scan → slices → agree) → Execute
                                                        → delivery intent
                                                        → notes → commit
                                                        → Issue update when needed
```

1. If `unlock.scope` is not true, keep actions read-only and do not run `scope` from this phase. Name `/discussion` if the focus needs confirmation; phase handoff does not confirm scope.
2. Run `agenda` + matching `agenda/references/*` (Goal/Discover or Build). Stop after first agenda dump until user agrees.
3. Before edits → `rules` + matching `rules/references/*`.
4. Issue create/update → `issue` + matching template.
5. Execute agreed slice. Softs only from this phase (or the user) — not from other softs.
6. Direction change mid-session → name `/discussion`. Meta/harness → name `/chore`.
7. Delivery is user-directed:
   - User asks to commit → hand off to `notes`, then `commit`.
   - User asks for review only → hand off to `commit` in review-only mode.
   - No delivery request → finish without triggering either skill.
   - Do not copy the `notes` or `commit` procedures into this phase.

Edits need `unlock.scope` → `unlock.agenda` → `unlock.rules`. Reading a skill unlocks its gate where specified — still **execute** its procedure.

## Produces

- An agreed product slice executed with its issue, `findings/`, or validation surface updated as needed.

## Handoff

- `discussion` / `scope` when focus changes or remains unclear.
- `agenda` for planning, `issue` for product-state writes, `rules` before edits, and the relevant soft skill for domain work.
- `notes` → `commit` when the user explicitly requests delivery.

## Limits

- Do not self-invoke `/discussion` or `/chore` — name them.
- Do not dump Research / HTML / matrices into issue bodies — `findings/` only.
- Do not skip agenda agreement before execute.
- Do not treat Build issue as a durable slice list — slices stay in chat via `agenda`.

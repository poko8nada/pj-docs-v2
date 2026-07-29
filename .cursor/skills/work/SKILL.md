---
name: work
description: >-
  Hands-on session phase for Goal / Discover / Build product work.
  After discussion agrees the session scope: use agenda (inventory → slices → user agreement), then execute and commit.
  Soft skills, cheap media, product code, and issue updates all ride the same rail.
  Use when the user invokes /work. Not for session direction (discussion) or harness/meta/light fixes (chore).
disable-model-invocation: true
---

# work

Hands-on phase for what **this session** already agreed in discussion. Judgment lives in Goal / Discover / Build issues; concrete soft output lives under `findings/`.

Harness / meta / unrelated light fixes → `/chore`. Session direction → `/discussion`.

## Agenda (required)

Product cuts live in the **`agenda` skill** — inventory, slice table, **user agreement before execute**. Do not copy that content here.

**Harness:** Read `.cursor/skills/agenda/SKILL.md` sets `unlock.agenda: true` (work only). Edits need `unlock.scope` → `unlock.agenda` → `unlock.rules`. `/chore` does not use `unlock.agenda` (`null`).

**Agreement:** After presenting the agenda (or the next slice), stop and wait for the user. Do not implement in the same turn as the first agenda dump.

## Rail (every situation)

At each step: discuss and agree when judgment is needed.

```text
scope → agenda (inventory → slices → user agrees) → Execute → Commit
                                              → Issue update when needed
```

Execute may include soft runs, `findings/`, cheap media, product edits, and even issue _create_ when that is part of the slice. Soft comment / axis updates often land at the end of the soft’s slice (or a follow-up slice), after any discussion.

## On entry

**Handshake:** Session focus → Read `.cursor/skills/scope/SKILL.md` if `scope` is not open. Agenda → Read `.cursor/skills/agenda/SKILL.md` (and get agreement before execute). File edits → Read `.cursor/skills/rules/SKILL.md`, then a matching `rules/references/*`. Issue create/update → Read `.cursor/skills/issue/SKILL.md`, then `goal` / `discover` / `build` template.

Inspect open `[Goal]` / `[Discover]` / `[Build]` and `findings/` as needed.

- **Scope already agreed** (discussion opened scope) → Read `agenda` and start inventory / agreed slice; no ceremony on Theme.
- **Scope unclear** → Read `scope` or name `/discussion`. Not a question dump.

Then Read the matching reference and stay on the rail:

- **Goal / Discover** (axes, softs, cheap media, open Build when ready) → `references/goal-discover.md`
- **Build** (Roadmap / Test / Deploy + product code; softs still OK) → `references/build.md`

Scope changed mid-session → name `/discussion`. Do not redefine session direction here.

## Hard limits

- Do not self-invoke `/discussion` or `/chore` — name them for the user.
- Do not invoke soft skills from each other — only this phase (or the user) calls softs.
- Do not dump Research / HTML / matrices into issue bodies — those stay in `findings/`.
- Do not skip agenda → user agreement before execute.
- Do not treat Build issue as a durable Plan of slices — session slices stay in chat via `agenda`.

Hand off to `scope` / `agenda` / `issue` / `rules` / soft skills by name — do not copy their contents here.

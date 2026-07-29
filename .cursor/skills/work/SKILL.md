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

Running a skill unlocks the harness (it detects the skill file Read). That is not the work — **execute** each skill’s procedure.

## Agenda (required)

Planning lives in the **`agenda` skill**. Situation guidance lives in its `references/` — execute the matching Goal/Discover or Build ref when inventoring and slicing.

**Harness:** Running the agenda skill opens `unlock.agenda` in work (the harness detects the skill file Read). Edits need `unlock.scope` → `unlock.agenda` → `unlock.rules`. `/chore` keeps `unlock.agenda` null.

**Agreement:** After presenting the agenda (or the next slice), stop and wait for the user. Do not implement in the same turn as the first agenda dump.

## Rail (every situation)

At each step: discuss and agree when judgment is needed.

```text
scope → agenda (inventory → slices → user agrees) → Execute → Commit
                                              → Issue update when needed
```

Execute may include soft runs, `findings/`, cheap media, product edits, and even issue _create_ when that is part of the slice. Soft comment / axis updates often land at the end of the soft’s slice (or a follow-up slice), after any discussion.

## On entry

Execute the skills this session needs (running them also unlocks the harness):

- Session focus → execute `.cursor/skills/scope/SKILL.md` if `scope` is not open
- Agenda → execute `.cursor/skills/agenda/SKILL.md` and the matching `agenda/references/*` (Goal/Discover or Build)
- File edits → execute `.cursor/skills/rules/SKILL.md` and a matching `rules/references/*`
- Issue create/update → execute `.cursor/skills/issue/SKILL.md` and the matching `goal` / `discover` / `build` template

Inspect open `[Goal]` / `[Discover]` / `[Build]` and `findings/` as needed.

- **Scope already agreed** (discussion opened scope) → execute `agenda` and the matching `agenda/references/*`, start inventory / agreed slice; no ceremony on Theme.
- **Scope unclear** → execute `scope` or name `/discussion`. Not a question dump.

Scope changed mid-session → name `/discussion`. Session direction is not redefined here.

## Hard limits

- Do not self-invoke `/discussion` or `/chore` — name them for the user.
- Do not invoke soft skills from each other — only this phase (or the user) calls softs.
- Do not dump Research / HTML / matrices into issue bodies — those stay in `findings/`.
- Do not skip agenda → user agreement before execute.
- Do not treat Build issue as a durable list of slices — session slices stay in chat via `agenda`.

Hand off to `scope` / `agenda` / `issue` / `rules` / soft skills by name.

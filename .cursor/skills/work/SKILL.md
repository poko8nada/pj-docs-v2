---
name: work
description: >-
  Hands-on session phase for Goal / Discover / Build product work.
  After discussion agrees the session scope: inventory, slice, execute, commit as agreed, update issues when needed.
  Soft skills, cheap media, product code, and issue updates all ride the same rail.
  Use when the user invokes /work. Not for session direction (discussion) or harness/meta/light fixes (chore).
disable-model-invocation: true
---

# work

Hands-on phase for what **this session** already agreed in discussion. Judgment lives in Goal / Discover / Build issues; concrete soft output lives under `findings/`.

Harness / meta / unrelated light fixes → `/chore`. Session direction → `/discussion`.

## Slice (core)

A **slice** is one sitting of work that adds **one verifiable concern**, cut from an **inventory** of the agreed session scope — never from an empty list, never as a horizontal layer (all APIs, then all UI, then all tests). Soft and issue work use the same idea: one concern per slice (e.g. one look-workshop pass, one axis update), agreed in chat before execute.

Do not invent slices from nothing:

1. **Inventory** — list what is in scope this session (short bullets in chat).
2. **Slice order** — only then sequence into thin vertical slices.

**Two rules — do not collapse them:**

1. **Concern order** — grow behavior (or a verifiable outcome) thinly. Incomplete _breadth_ early is fine; incomplete _quality_ of data or of the concern’s fidelity is not.
2. **Fidelity** — “draft” means _fewer concerns_, not fake-looking data or sloppy soft output. No throwaway placeholders (`foo`, `lorem`) just because the slice is early.

**Avoid bundling:** full feature in one slice; horizontal cuts (tests-only later; all UI then all logic); merging slices because of a dependency (`prerequisite:` is a note, not a merge reason).

**Agree in chat per slice** before execute. Issue body updates at milestones when needed — not after every slice by default.

## Rail (every situation)

At each step: discuss and agree when judgment is needed.

```text
Inventory → Slice → Execute → Commit (per slice or batched — as agreed)
                → Issue update when needed
```

Execute may include soft runs, `findings/`, cheap media, product edits, and even issue _create_ when that is part of the slice. Soft comment / axis updates often land at the end of the soft’s slice (or a follow-up slice), after any discussion.

## On entry

**Handshake:** File edits → Read `.cursor/skills/rules/SKILL.md`, then a matching `rules/references/*`. Issue create/update → Read `.cursor/skills/issue/SKILL.md`, then `goal` / `discover` / `build` template.

Inspect open `[Goal]` / `[Discover]` / `[Build]` and `findings/` as needed. Present **Context / Understanding / Proposal** — session scope + which situation below + first inventory/slice move. Not a question dump.

Then Read the matching reference and stay on the rail:

- **Goal / Discover** (axes, softs, cheap media, open Build when ready) → `references/goal-discover.md`
- **Build** (Roadmap / Test / Deploy + product code; softs still OK) → `references/build.md`

Scope unclear or changed → name `/discussion`. Do not redefine the session goal here.

## Hard limits

- Do not self-invoke `/discussion` or `/chore` — name them for the user.
- Do not invoke soft skills from each other — only this phase (or the user) calls softs.
- Do not dump Research / HTML / matrices into issue bodies — those stay in `findings/`.
- Do not skip inventory → slice → agree before execute.
- Do not treat Build issue as a durable Plan of slices — session slices live in chat.

Hand off to `issue` / `rules` / soft skills by name — do not copy their contents here.

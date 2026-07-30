---
name: discussion
description: >-
  Default session phase and return hatch from hands-on work.
  Agree session scope via the `scope` skill when change intent appears — not only at /work or /chore entry.
  Read Goal / Discover / Build issues, soft comments, findings/, and (when Build-relevant) product code.
  Use when starting a conversation, stepping back from hands-on, or when focus must be re-agreed.
  Exit is focus agreement — not slicing and not shipping. `/discussion` closes the scope gate.
disable-model-invocation: true
---

# discussion

Agree **this session’s scope** via the `scope` skill.

There is **no plan issue** and no progress tracker — the agent must analyze Goal / Discover / Build (bodies + soft comments), related `findings/`, and when Build is in play the product code, then think and respond.

Do not ship here. Do not inventory→slice here — that is `/work` via the `agenda` skill.

Scope agreement in discussion **is** the session focus — `/work` and `/chore` inherit it when the gate is already open.

### Default

Converse naturally. `AGENTS.md` 理解 handles reception; do not dump a formatted scope block on every turn.

When **change intent** appears, execute `scope` and agree Theme (even when obvious) before hands-on or before listing implementation choices.

### Exit

The user agrees the scope (which Goal/Discover axis, soft continuation, or Build concern this session is about).

What happens next (stay talking, `/work`, `/chore`) is the user’s call — do not treat naming `/work` as required exit criteria.

### Close

User invoking `/discussion` clears harness `scope` (edits lock again until `scope` is run again).

### Read-only constraints

**No editing** product/harness code. No mutating `gh`/`git`. No issue create/update — read issues as source of truth only.

Reading code and issues is required for judgment.

First user prompt in a conversation starts here automatically. User may invoke `/discussion` anytime to step back from `/work` or `/chore`.

## When to run scope

Execute `scope` when any of these become true (still in discussion — do **not** wait for `/work` or `/chore`):

- User signals change intent — e.g. align, extract, fix, implement, “let’s do X”
- You would list implementation choices (A vs B, file split) before agreement
- Topic shifts from question-only to a change direction
- Before handing off to hands-on if the gate is not open

Do not run a full scope block when:

- Opinion, review, or explanation only — e.g. “what do you think?”, “why is it like this?”
- Same agreed Theme; continuing detail — see `scope` skill **When not to re-block**; do not re-dump every turn

### Shape

Direction clear, boundaries thin → Theme in prose is enough.

Boundaries matter or multiple paths → Theme + In / Out + label (`scope` skill).

Goal / Discover / Build product work belongs in `/work` — say so in Out of scope when the thread is chore-shaped meta only.

## On entry

1. Read open `[Goal]` / `[Discover]` / `[Build]` bodies and their comments (especially `## soft: …`).
2. Follow soft `Path`s into `findings/` when cited or when Summary/Why implies unfinished work.
3. If Goal + Discover look agreed and Build is open (or the session is clearly Build-stage), read the product tree / relevant code — axes alone are not enough.
4. Synthesize — there is no checklist of “what’s next.” Derive judgment from the evidence.
5. Respond — match the user’s mode; run `scope` per **When to run scope** above.

### Judgment

1. **Goal is the north star** — the covenant (What is this / Goal / Non-goal) is what must eventually hold. It is not a gate you finish before Discover starts.
2. Goal is found through discussion and Discover — softs, cheap media, and Discover axes are materials that shape Goal. Some Discover axes may reach agreed while Goal is still open.
3. Goal stays — once agreed, reopen only if the user or agent strongly requires it. Default returns rethink Discover, not Goal.
4. Soft comments matter — may imply continuation of that soft under a hands-on focus, not only a closed pointer.
5. Goal + Discover both agreed → Build-oriented focus — propose from Roadmap / Test / Deploy and what the code actually is (when Build is in play).
6. Return is normal — leaving hands-on work back to `/discussion` to rethink Discover (or focus) is expected, not failure.

### Typical anchors

- Early / both Goal and Discover open → advance the covenant and/or Discover axes (they grow together); concrete soft/media work waits until scope is agreed and hands-on begins
- Soft comment looks open-ended → scope = continue that soft, then refresh the same comment in hands-on
- Goal still open but some Discover axes already agreed → keep using Discover as input to Goal; do not reset agreed Discover without reason
- Goal + Discover both agreed, no Build → scope = open Build (grounded in axes; code may still be thin)
- Goal + Discover both agreed, Build open → read code + Build axes + softs/findings → agree a concrete Build scope
- Code and Build axes disagree → say so; scope = Discover rethink or Build-axis update in hands-on
- Discover must change after hands-on → `/discussion` to rethink scope / Discover
- Goal change only on strong request → redefinition; otherwise keep Goal fixed
- Tiny harness / typo / meta only → `/chore` is enough (no product scope required) — still execute `scope` (thin Theme) before edits

When the session topic is still fuzzy, do not invent a `label` slug yet (`scope` skill owns label).

Revise until the user agrees the scope. Do not drift into implementation or a slice plan.

## Flow

1. Analyze — issues, soft comments, findings as needed, and product code when Build-stage. Think; do not wait for a plan or progress field that does not exist.
2. Agree scope — per **When to run scope**; use full In / Out when boundaries matter.
3. Exit — when scope is agreed, stop. Do not self-invoke `/work` or `/chore`. Naming them is optional when it helps; it is not the exit condition.

## Hard limits

- Do not run `.cursor/skills/rules/SKILL.md` for edits — that unlock does not apply in this phase.
- Do not create or update GitHub issues here — that belongs in `/work` (or `/chore`) via `issue`.
- Do not run mutating `gh`/`git`, `pnpm`, or other shell that changes the repo.
- Do not skip code reading when the session is Build-stage — scope judgment without code is incomplete.
- Do not inventory→slice or lock a slice list here — `/work` + `agenda` own that after scope is agreed.
- Do not copy `scope` / `agenda` / `work` / `chore` / soft skill contents here — hand off by name.

Hand off to `scope` / `agenda` by name — do not copy their contents here.

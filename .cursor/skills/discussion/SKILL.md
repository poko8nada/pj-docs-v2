---
name: discussion
description: >-
  Default session phase and return hatch from hands-on work.
  Agree session scope via the `scope` skill (always — even when obvious), reading Goal / Discover / Build issues, soft comments, findings/, and (when Build-relevant) the product code.
  Use when starting a conversation, stepping back from /work or /chore, or when focus must be re-agreed.
  Exit is focus agreement — not slicing and not shipping. `/discussion` also closes the scope gate.
disable-model-invocation: true
---

# discussion

Agree **this session’s scope** via the `scope` skill. There is **no plan issue and no progress tracker** — the agent must **analyze** Goal / Discover / Build (bodies + soft comments), related `findings/`, and when Build is in play the **product code**, then **think** and respond. Do not ship here. Do not inventory→slice here — that is `/work` via the **`plan` skill**.

**Default:** converse naturally. `AGENTS.md` **理解:** handles reception; do **not** open with a formatted scope block on every entry — but **do** Read `scope` and agree Theme (even when obvious) before handing off to hands-on.

**Exit:** the user agrees the scope (which Goal/Discover axis, soft continuation, or Build concern this session is about). What happens next (stay talking, `/work`, `/chore`) is the user’s call — do not treat naming `/work` as required exit criteria.

**Close:** User invoking `/discussion` clears harness `scope` (edits lock again until `scope` is re-Read).

**No editing** product/harness code. **No mutating gh/git** (read-only). **No issue create/update** — read issues as source of truth only. **Reading** code and issues is required for judgment.

First user prompt in a conversation starts here automatically. User may invoke `/discussion` anytime to step back from `/work` or `/chore`.

## On entry

1. Read open `[Goal]` / `[Discover]` / `[Build]` bodies and their **comments** (especially `## soft: …`).
2. Follow soft `Path`s into `findings/` when cited or when Summary/Why implies unfinished work.
3. If Goal + Discover look agreed and Build is open (or the session is clearly Build-stage), **read the product tree / relevant code** — axes alone are not enough.
4. **Synthesize** — there is no checklist of “what’s next.” Derive judgment from the evidence.
5. **Respond** — match the user’s mode. When focus must be locked (or before hands-on), Read and follow `scope` (Theme / In / Out + label).

### Judgment

1. **Goal is the north star** — the covenant (What is this / Goal / Non-goal) is what must eventually hold. It is not a gate you finish before Discover starts.
2. **Goal is found through discussion and Discover** — softs, cheap media, and Discover axes are materials that shape Goal. Some Discover axes may reach agreed while Goal is still open.
3. **Goal stays** — once agreed, reopen only if the user or agent **strongly** requires it. Default returns rethink **Discover**, not Goal.
4. **Soft comments matter** — may imply **continuation** of that soft under a hands-on focus, not only a closed pointer.
5. **Goal + Discover both agreed → Build-oriented focus** — propose from Roadmap / Test / Deploy **and** what the code actually is (when Build is in play).
6. **Return is normal** — leaving hands-on work back to `/discussion` to rethink Discover (or focus) is expected, not failure.

### Typical anchors

- Early / both Goal and Discover open → advance the covenant **and/or** Discover axes (they grow together); concrete soft/media work waits until scope is agreed and hands-on begins
- Soft comment looks open-ended → scope = continue that soft, then refresh the same comment in hands-on
- Goal still open but some Discover axes already agreed → keep using Discover as input to Goal; do not reset agreed Discover without reason
- Goal + Discover both agreed, no Build → scope = open Build (grounded in axes; code may still be thin)
- Goal + Discover both agreed, Build open → **read code** + Build axes + softs/findings → agree a concrete Build scope
- Code and Build axes disagree → say so; scope = Discover rethink or Build-axis update in hands-on
- Discover must change after hands-on → `/discussion` to rethink scope / Discover
- Goal change only on strong request → redefinition; otherwise keep Goal fixed
- Tiny harness / typo / meta only → `/chore` is enough (no product scope required) — still Read `scope` (thin Theme) before edits

When the session topic is still fuzzy, do not invent a `label` slug yet (`scope` skill owns label).

Revise until the user agrees the **scope**. Do not drift into implementation or a slice plan.

## Flow

1. **Analyze** — issues, soft comments, findings as needed, and product code when Build-stage. Think; do not wait for a plan or progress field that does not exist.
2. **Agree scope** — Read and follow `scope` (always before hands-on; use the block when boundaries matter).
3. **Exit** — when scope is agreed, stop. Do not self-invoke `/work` or `/chore`. Naming them is optional when it helps; it is not the exit condition.

## Hard limits

- Do **not** Read `.cursor/skills/rules/SKILL.md` for edits — that handshake does not apply in this phase.
- Do **not** create or update GitHub issues here — that belongs in `/work` (or `/chore`) via `issue`.
- Do **not** run mutating `gh`/`git`, `pnpm`, or other shell that changes the repo.
- Do **not** skip code reading when the session is Build-stage — scope judgment without code is incomplete.
- Do **not** inventory→slice or lock a slice list here — `/work` + `plan` own that after scope is agreed.
- Do **not** copy `scope` / `plan` / `work` / `chore` / soft skill contents here — hand off by name.

Hand off to `scope` / `plan` by name — do not copy their contents here.

---
name: discussion
description: >-
  Default session phase and return hatch from hands-on work.
  Agree this session's focus by reading Goal / Discover / Build issues, soft comments, findings/, and (when Build-relevant) the product code.
  Use when starting a conversation, stepping back from /work or /chore, or when focus must be re-agreed.
  Exit is focus agreement — not slicing and not shipping.
disable-model-invocation: true
---

# discussion

Agree **this session’s focus**. There is **no plan issue and no progress tracker** — the agent must **analyze** Goal / Discover / Build (bodies + soft comments), related `findings/`, and when Build is in play the **product code**, then **think** and propose a focus. Do not ship here. Do not inventory→slice here — that is `/work`.

**Exit:** the user agrees the focus (which Goal/Discover axis, soft continuation, or Build concern this session is about). What happens next (stay talking, `/work`, `/chore`) is the user’s call — do not treat naming `/work` as required exit criteria.

**No editing** product/harness code. **No mutating gh/git** (read-only). **No issue create/update** — read issues as source of truth only. **Reading** code and issues is required for judgment.

First user prompt in a conversation starts here automatically. User may invoke `/discussion` anytime to step back from `/work` or `/chore`.

## On entry

1. Read open `[Goal]` / `[Discover]` / `[Build]` bodies and their **comments** (especially `## soft: …`).
2. Follow soft `Path`s into `findings/` when cited or when Summary/Why implies unfinished work.
3. If Goal + Discover look agreed and Build is open (or the session is clearly Build-stage), **read the product tree / relevant code** — axes alone are not enough.
4. **Synthesize** — there is no checklist of “what’s next.” Derive a **focus** from the evidence.
5. Present **Context / Understanding / Proposal** in one message — reasoned judgment for **this session’s focus**, not a question dump, slice list, or regurgitated issue outline.

### Judgment

1. **Goal is the north star** — the covenant (What is this / Goal / Non-goal) is what must eventually hold. It is not a gate you finish before Discover starts.
2. **Goal is found through discussion and Discover** — softs, cheap media, and Discover axes are materials that shape Goal. Some Discover axes may reach agreed while Goal is still open.
3. **Goal stays** — once agreed, reopen only if the user or agent **strongly** requires it. Default returns rethink **Discover**, not Goal.
4. **Soft comments matter** — may imply **continuation** of that soft under a hands-on focus, not only a closed pointer.
5. **Goal + Discover both agreed → Build-oriented focus** — propose from Roadmap / Test / Deploy **and** what the code actually is (when Build is in play).
6. **Return is normal** — leaving hands-on work back to `/discussion` to rethink Discover (or focus) is expected, not failure.

### Typical anchors

- Early / both Goal and Discover open → propose a focus that best advances the covenant **and/or** Discover axes (they grow together); concrete soft/media work waits until focus is agreed and hands-on begins
- Soft comment looks open-ended → propose focus = continue that soft, then refresh the same comment in hands-on
- Goal still open but some Discover axes already agreed → keep using Discover as input to Goal; do not reset agreed Discover without reason
- Goal + Discover both agreed, no Build → propose focus = open Build (grounded in axes; code may still be thin)
- Goal + Discover both agreed, Build open → **read code** + Build axes + softs/findings → propose a concrete Build focus
- Code and Build axes disagree → say so in Understanding; propose focus = Discover rethink or Build-axis update in hands-on
- Discover must change after hands-on → `/discussion` to rethink focus / Discover
- Goal change only on strong request → redefinition; otherwise keep Goal fixed
- Tiny harness / typo / meta only → `/chore` is enough (no product focus required)

When the session topic is still fuzzy, do not invent a `label` slug yet.

Revise until the user agrees the **focus**. Do not drift into implementation or a slice plan.

## Flow

1. **Analyze** — issues, soft comments, findings as needed, and product code when Build-stage. Think; do not wait for a plan or progress field that does not exist.
2. **Propose** — one session **focus** with reasons (Context / Understanding / Proposal).
3. **Label** — once the focus is clear, run `label` (`node .cursor/skills/label/scripts/set-label.mjs <slug>`). Skip only while still fuzzy.
4. **Exit** — when focus is agreed, stop. Do not self-invoke `/work` or `/chore`. Naming them is optional when it helps; it is not the exit condition.

## Hard limits

- Do **not** Read `.cursor/skills/rules/SKILL.md` for edits — that handshake does not apply in this phase.
- Do **not** create or update GitHub issues here — that belongs in `/work` (or `/chore`) via `issue`.
- Do **not** run mutating `gh`/`git`, `pnpm`, or other shell that changes the repo.
- Do **not** skip code reading when the session is Build-stage — Proposal without code is incomplete.
- Do **not** inventory→slice or lock a slice list here — `/work` owns that after focus is agreed.

Do not copy `work` / `chore` / soft skill contents here.

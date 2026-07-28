---
name: discussion
description: >-
  Default session phase and return hatch from hands-on work.
  Agree session scope by reading Goal / Discover / Build issues, soft comments, findings/, and (when Build-relevant) the product code.
  Use Theme / In scope / Out of scope only when focus agreement is the blocker — not on every entry.
  Use when starting a conversation, stepping back from /work or /chore, or when focus must be re-agreed.
  Exit is focus agreement — not slicing and not shipping.
disable-model-invocation: true
---

# discussion

Agree **this session’s scope**. There is **no plan issue and no progress tracker** — the agent must **analyze** Goal / Discover / Build (bodies + soft comments), related `findings/`, and when Build is in play the **product code**, then **think** and respond. Do not ship here. Do not inventory→slice here — that is `/work`.

**Default:** converse naturally. `AGENTS.md` **理解:** handles reception; do **not** open with a formatted scope block on every entry.

**Exit:** the user agrees the scope (which Goal/Discover axis, soft continuation, or Build concern this session is about). What happens next (stay talking, `/work`, `/chore`) is the user’s call — do not treat naming `/work` as required exit criteria.

**No editing** product/harness code. **No mutating gh/git** (read-only). **No issue create/update** — read issues as source of truth only. **Reading** code and issues is required for judgment.

First user prompt in a conversation starts here automatically. User may invoke `/discussion` anytime to step back from `/work` or `/chore`.

## On entry

1. Read open `[Goal]` / `[Discover]` / `[Build]` bodies and their **comments** (especially `## soft: …`).
2. Follow soft `Path`s into `findings/` when cited or when Summary/Why implies unfinished work.
3. If Goal + Discover look agreed and Build is open (or the session is clearly Build-stage), **read the product tree / relevant code** — axes alone are not enough.
4. **Synthesize** — there is no checklist of “what’s next.” Derive judgment from the evidence.
5. **Respond** — match the user’s mode. Use **Scope agreement** (below) only when that section says to.

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
- Tiny harness / typo / meta only → `/chore` is enough (no product scope required)

When the session topic is still fuzzy, do not invent a `label` slug yet.

Revise until the user agrees the **scope**. Do not drift into implementation or a slice plan.

## Scope agreement

Use **only when scope agreement is the blocker** — not every turn, not on every `/discussion` entry.

### When to use

- User intent is vague or multiple tracks compete (Goal / Discover / Build / soft)
- Returning from `/work` with stalled or shifted direction
- Issues and the user’s message pull in different directions
- User asks for orientation (“what should we focus on?”)
- First message with open issues but no stated topic (auto-start only)

### When not to use

- User already stated the topic — dig in; **理解:** is enough
- Continuing an agreed scope (same beat, next turn)
- Single direct question or clear meta request
- Scope agreement was just agreed — do not repeat until scope changes or user rejects
- User says “got it” / “move on” — return to normal conversation

Light case: **Theme** alone in prose is enough. Use the full block when in/out scope boundaries matter.

### Format

```markdown
**Theme:** {one line — session thread}

**In scope:**

- …

**Out of scope:**

- …
```

| Field        | Write                                          | Do not write                         |
| ------------ | ---------------------------------------------- | ------------------------------------ |
| Theme        | One-line umbrella for this conversation beat   | Issue body regurgitation, file lists |
| In scope     | 1–3 bullets — what we treat now                | Slice table, implementation steps    |
| Out of scope | 1–3 bullets — what we deliberately exclude now | Straw men nobody would ask for       |

**Good (Goal discussion):**

- Theme: Goal covenant abstraction
- In scope: who benefits, what outcome we promise
- Out of scope: stack, screens, MVP feature list (Discover)

**Bad (feature drift):**

- Theme: Build the todo app
- In scope: Next.js, drag-and-drop, auth
- Out of scope: (empty)

### If the user rejects

1. Do **not** repeat the same block unchanged — revise Theme and/or In scope / Out of scope.
2. One clarifying question at most, then a revised block if still blocked.
3. Treat rejection as flawed scope judgment (see `AGENTS.md`); do not argue or push `/work`.
4. If Theme is wrong → rewrite Theme first; thin In scope until aligned.
5. If boundaries are wrong → keep Theme; fix In scope / Out of scope.
6. User changes topic → drop the old scope; follow the new thread (re-agree only if needed).
7. No edit, issue write, or self-invoked `/work` until scope is agreed.

## Flow

1. **Analyze** — issues, soft comments, findings as needed, and product code when Build-stage. Think; do not wait for a plan or progress field that does not exist.
2. **Agree scope** — when the blocker calls for it, use Scope agreement; otherwise converse.
3. **Label** — once Theme is stable, run `label` (`node .cursor/skills/label/scripts/set-label.mjs <slug>`). Skip while still fuzzy.
4. **Exit** — when scope is agreed, stop. Do not self-invoke `/work` or `/chore`. Naming them is optional when it helps; it is not the exit condition.

## Hard limits

- Do **not** Read `.cursor/skills/rules/SKILL.md` for edits — that handshake does not apply in this phase.
- Do **not** create or update GitHub issues here — that belongs in `/work` (or `/chore`) via `issue`.
- Do **not** run mutating `gh`/`git`, `pnpm`, or other shell that changes the repo.
- Do **not** skip code reading when the session is Build-stage — scope judgment without code is incomplete.
- Do **not** inventory→slice or lock a slice list here — `/work` owns that after scope is agreed.

Do not copy `work` / `chore` / soft skill contents here.

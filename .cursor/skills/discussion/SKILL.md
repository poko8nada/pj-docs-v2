---
name: discussion
description: >-
  Default session phase and explicit return from work phases.
  Use when discussing direction, researching, or stepping back from Spec / Design / Forge / Refine / Chore.
disable-model-invocation: true
---

# discussion

Discuss and research before any work phase commits the session to deliverables or code. **No product/harness code.** **No mutating gh/git** (read-only). **No issue create/update** — read issues as source of truth only.

First user prompt in a conversation starts here automatically. User may also invoke `/discussion` to return from a work phase.

## On entry

Inspect the repo and open issues (read only). Then present **Context / Understanding / Proposal** in one message — where things stand and what to discuss next, not a question dump.

Typical states (use as anchors in Understanding):

- Direction unclear → discuss options; run `feasibility` when a technical choice needs current sources
- Enough clarity for a deliverable → propose the user invoke `/spec`, `/design`, `/forge`, `/refine`, or `/chore` — do **not** self-invoke
- Returned from a work phase → restate what was agreed in that phase and what is now open; wait for user before re-entering work
- Request is clearly tiny harness/meta fix → say user should invoke `/chore`, not stretch discussion

When the session topic is still fuzzy, do not invent a `label` slug yet.

Revise until the user agrees the next move. Do not drift into implementation.

## Flow

1. **Discuss** — goal, constraints, trade-offs. Edit root-level `*.md` only when it helps the conversation (gate allows).
2. **Research** — `feasibility` when stack/approach needs cited investigation; read issues with read-only `gh`/`git`.
3. **Label** — Before handing off (or earlier once the topic is clear), run the `label` skill (`node .cursor/skills/label/scripts/set-label.mjs <slug>`). Required before naming the next phase for the user. Skip only while the topic is still fuzzy.
4. **Hand off** — when a deliverable or code change is needed, name the right phase skill and stop. User invokes it explicitly.

## Hard limits

- Do **not** Read `.cursor/skills/rules/SKILL.md` for edits — that handshake does not apply in this phase.
- Do **not** create or update GitHub issues here — that belongs in work phases via `issue` skill after user entry.
- Do **not** run mutating `gh`/`git`, `pnpm`, or other shell that changes the repo.

Hand off to `feasibility` or work phase skills by name — do not copy their contents here.

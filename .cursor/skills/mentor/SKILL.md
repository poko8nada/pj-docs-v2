---
name: mentor
description: >-
  Human-centered coding overlay: agent advises; human owns implementation.
  Same session as /work or /chore — does not replace phase. User-only — do not self-invoke.
disable-model-invocation: true
---

# mentor

**User-only.** Put the **human at the center of writing code** so skills stay sharp and learning sticks. The agent is a mentor: clarify intent, point at risks, propose structure, review the user’s work. Prefer questions and small hints over finishing the feature for them.

Does **not** change `phase` or `unlock.*`. `/work` / `/chore` / `/discussion` stay as they are — mentor is a layer on top.

## Role (while on)

- Default: advise, outline approaches, call out edge cases — **do not** drive the implementation.
- When the user wants a starting shape, they send `/stub` (one turn). Prefer signatures, stubs, and TODOs over full bodies unless they ask for more in that turn.
- After `/stub`, go back to mentoring on the next prompt unless they `/stub` again.
- Leave mentor with `/mentor off` when the session should return to normal agent-centered coding.

## On / Off

| Method        | Action                                      |
| ------------- | ------------------------------------------- |
| `/mentor`     | Enter mentor (`mentor: true` in gate state) |
| `/mentor off` | Leave mentor (explicit only; not sessionEnd) |

## Gate (harness)

While on and **not** in a `/stub` turn, the gate denies **reviewable code** paths (`ts`/`tsx`/`js`/`jsx`/`mjs`/`cjs`/`css`/`html`) and Shell that touches them. Other paths still follow normal phase / `unlock.rules`. That deny is the backstop — the role above is what you optimize for.

## Hard limits

- **Agents must not** invoke `/mentor`, `/mentor off`, or `/stub` on their own.
- `/stub` while mentor is off is a harness no-op (see `stub` skill).

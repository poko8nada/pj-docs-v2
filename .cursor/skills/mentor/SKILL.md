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

Layer by where the session is — do not collapse them.

### Drive (non-code)

Same momentum as without mentor: read issues / findings / code, advance the project, issue judgment, “what next,” and (in `/work`) inventory / slice proposals. Mentor does not mean passive. Planning and progress proposal are not mentor-only — this layer is the normal rail; mentor only changes how **code** is taught below.

### Code implementation → Digest / Hint

Once the agreed slice is in code (human writes; agent does not drive the edit). Scope is the **current agreed slice** only — not the whole session roadmap. Session-local map only; do not treat it as a durable project plan (slices stay in chat per `/work`).

**Read learner code from the repo** (Read / Grep) — do not ask them to paste it in chat. When the slice has a **Test** check, **run it yourself** (`pnpm test:run` or the agreed command) and report pass/fail. **Surface** stays human.

Align with the slice’s Test / Surface policy: product observation → Surface (browser, HTTP, CLI, etc.); pure logic → colocated unit test. Do not ask for e2e or component render tests.

Two layers — do not collapse them:

| Layer  | When                         | Density                                            |
| ------ | ---------------------------- | -------------------------------------------------- |
| Digest | slice enters implementation  | map — Done, Why, Steps with files and entries      |
| Hint   | step number or stuck on beat | per-entry processing — no full implementation code |

Before emitting Digest or Hint, execute `references/output-templates.md`.

Deeper questions → answer in chat. Starting shape → `/stub` (one turn).

#### How to split steps (before formatting)

Numbered steps are **concern beats** — each beat advances the vertical concern.

- Do **not** split one-file-at-a-time (no “finish this file, then the next”).
- Do **not** park all tests at the end (horizontal). When unit tests belong in the slice, they interleave with the logic they cover — same files may recur across steps.
- Do **not** invent test steps for UI-only work (Surface is enough).
- Target **3–7** steps. Fewer than 3 → keep short. More than 7 → slice is too thick; cut the slice (Drive / `/work`), do not inflate the Digest.

#### Digest

Output once when the slice enters implementation. Shape, entry kinds, and field rules → `references/output-templates.md`.

#### Hint

When the learner names a Digest step (by number) or is stuck on one beat. Shape and write/do-not-write rules → `references/output-templates.md`.

### `/stub`

When the user wants a starting shape, they send `/stub` (one turn). Prefer signatures, stubs, and TODOs over full bodies unless they ask for more in that turn. After `/stub`, return to mentoring on the next prompt unless they `/stub` again.

Leave mentor with `/mentor off` when the session should return to normal agent-centered coding.

## On / Off

| Method        | Action                                       |
| ------------- | -------------------------------------------- |
| `/mentor`     | Enter mentor (`mentor: true` in gate state)  |
| `/mentor off` | Leave mentor (explicit only; not sessionEnd) |

## Gate (harness)

While on and **not** in a `/stub` turn:

- **Read** is always allowed.
- **Edits** to reviewable code paths (`ts`/`tsx`/`js`/`jsx`/`mjs`/`cjs`/`css`/`html`) are denied.
- **`pnpm test` / `pnpm test:run`** in `/work` or `/chore` are allowed without `rules` unlock — use them for Test checks.
- Other Shell follows normal phase / `unlock.rules`. That deny is the backstop — the role above is what you optimize for.

## Hard limits

- **Agents must not** invoke `/mentor`, `/mentor off`, or `/stub` on their own.
- `/stub` while mentor is off is a harness no-op (see `stub` skill).

## References

- `references/output-templates.md` — Digest and Hint output shape (execute before emitting)

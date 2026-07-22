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

Still own momentum: project advance, issue judgment, “what next,” and (in `/work`) inventory / slice proposals. Mentor does not mean passive.

### Code implementation → next-move mode

Once the agreed slice is in code (human writes; agent does not drive the edit):

- Teach **one move at a time**. Do not finish the feature, the file, or the whole slice in one dump.
- A **move** = one concept inside the current vertical slice — roughly one short Udemy lecture (about 5–10 minutes of focused learner work). Not “finish this file,” not a horizontal layer.
- Verify with the slice’s Test / App policy: UI → App (human / browser); pure logic → colocated unit test. Do not ask for e2e or component render tests.

Use this shape each turn in next-move mode — these three blocks only; do not add 理由 / 確認 / やらないこと headings:

````markdown
**次:** （1行 — この一手で終わる状態）

**ポイント:**
- …
- …
（箇条書きでよい。2–3個）

**手引き:**

```ts
// 書く順の1塊 — 今書く範囲だけ（ファイル全文は出さない）
```

これは…（1短い段落。何の部品か／どこまでやるか）

```ts
// 2塊目
```

これは…
````

手引き rules: repeat **code fence → `これは…` paragraph** only (2–4 chunks). No bullets inside 手引き — bullets there push the model away from code. Partial / focused code only, in write order.

### `/stub`

When the user wants a starting shape, they send `/stub` (one turn). Prefer signatures, stubs, and TODOs over full bodies unless they ask for more in that turn. After `/stub`, return to mentoring on the next prompt unless they `/stub` again.

Leave mentor with `/mentor off` when the session should return to normal agent-centered coding.

## On / Off

| Method        | Action                                       |
| ------------- | -------------------------------------------- |
| `/mentor`     | Enter mentor (`mentor: true` in gate state)  |
| `/mentor off` | Leave mentor (explicit only; not sessionEnd) |

## Gate (harness)

While on and **not** in a `/stub` turn, the gate denies **reviewable code** paths (`ts`/`tsx`/`js`/`jsx`/`mjs`/`cjs`/`css`/`html`) and Shell that touches them. Other paths still follow normal phase / `unlock.rules`. That deny is the backstop — the role above is what you optimize for.

## Hard limits

- **Agents must not** invoke `/mentor`, `/mentor off`, or `/stub` on their own.
- `/stub` while mentor is off is a harness no-op (see `stub` skill).

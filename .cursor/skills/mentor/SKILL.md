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
| Digest | slice enters implementation  | map — 完了, なぜ, steps with files and entries     |
| Hint   | step number or stuck on beat | per-entry processing — no full implementation code |

Deeper questions → answer in chat. Starting shape → `/stub` (one turn).

#### How to split steps (before formatting)

Numbered steps are **concern beats** — each beat advances the vertical concern.

- Do **not** split one-file-at-a-time (no “finish this file, then the next”).
- Do **not** park all tests at the end (horizontal). When unit tests belong in the slice, they interleave with the logic they cover — same files may recur across steps.
- Do **not** invent test steps for UI-only work (Surface is enough).
- Target **3–7** steps. Fewer than 3 → keep short. More than 7 → slice is too thick; cut the slice (Drive / `/work`), do not inflate the Digest.

#### 1 — Digest

Output once when the slice enters implementation. No code fences (entries go under each file as plain text).

```markdown
**完了:** （このスライスが終わったときの状態・1文）

**なぜ:**

- （完了に近い条件）
- （その前提）
- …

**ステップ:**（3–7）

1. （動詞で始まる到達点・1行）
   - **`package.json`** (`edit`)
     - dependency: `zod` — runtime validation
     - script: `test:run` → `vitest run`

   - **`path/to/file.ts`** (`new`)
     - `type Session = { userId: string; expiresAt: Date }`
     - `function parseSession(raw: unknown): Session | null` — `raw`: … / returns: …

   - **`path/to/file.test.ts`** (`new`)
     - `describe('parseSession')` — cases: null input, invalid shape, valid

2. …
```

**完了** — slice end state in one sentence. Not the whole product goal.

**なぜ** — bullets only. Read top → bottom: closer to **完了** first, then prerequisites. Explains why this slice exists; do not repeat per step.

**ステップ** — implementation order. Each file is one bullet; nest **that file’s entries** under it. Same path may appear in multiple steps.

Write entries by kind — enough to implement without prose algorithms:

| Kind           | Include                                                 |
| -------------- | ------------------------------------------------------- |
| 型             | fields, optional, union members                         |
| 関数           | params, return type, throws if any                      |
| コンポーネント | props, children, events                                 |
| テスト         | `describe` / `it` angles                                |
| 依存           | package name, dev/prod; `pnpm add` when one-off         |
| config         | keys, plugins, paths, env var names                     |
| ルート / API   | path, method, handler name                              |
| スキーマ       | table, column, migration direction                      |
| 定数 / env     | name, meaning, example value                            |
| スクリプト     | `package.json` script name and command                  |
| その他         | when not a symbol — what to do in that file (1–2 lines) |

Do **not** add フロー, チェック, or per-step なぜ fields.

Close with: step number → Hint; deeper detail → chat or `/stub`.

#### 2 — Hint

When the learner names a Digest step (by number) or is stuck on one beat.

For **each entry in that step**, describe **what it does** — input, branches, return, config effect — in short bullets or lines. Teach processing, not file layout (Digest already has that).

**Write:** responsibility, data flow, edge cases, one pitfall if non-obvious.

**Do not write:** function bodies, import lists, or copy-paste-ready code. That is `/stub` or normal implementation, not Hint.

```markdown
### Hint: ステップ 2

**`parseSession`**

- takes `unknown`; non-object → `null`
- requires `userId` string; otherwise `null`
- returns `{ userId, expiresAt }` when valid

**`Session`**

- return shape for parse; `expiresAt` typed here if used later
```

Do not re-dump the whole Digest unless they ask to reorient.

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

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

### Code implementation → Digest / Deep Dive

Once the agreed slice is in code (human writes; agent does not drive the edit). Scope is the **current agreed slice** only — not the whole session roadmap. Session-local map only; do not treat it as a durable project plan (slices stay in chat per `/work`).

Align checks with the slice’s Test / Surface policy: product observation → Surface (browser, HTTP, CLI, etc.); pure logic → colocated unit test. Do not ask for e2e or component render tests.

#### How to split (before formatting)

Numbered steps are **concern beats** — each beat advances the vertical concern to something checkable.

- Do **not** split one-file-at-a-time (no “finish this file, then the next”).
- Do **not** park all tests at the end (horizontal). When unit tests belong in the slice, they interleave with the logic they cover — same files may recur across steps.
- Do **not** invent test steps for UI-only work (Surface is enough).
- Same path may appear in multiple steps. UI, logic, wiring, and data can mix in one digest — the **fields** stay the same. Per step: ファイル / シンボル / フロー are required; チェック is optional (omit the whole line if none).
- Target **3–7** steps. Fewer than 3 → keep short. More than 7 → slice is too thick; cut the slice (Drive / `/work`), do not inflate the digest.

Density: **barely implementable** — not a vague outline, not full source dumps. Fill rules below remove overlap; do not invent extra headings.

#### 1 — Digest (first)

Output this shape once when the slice enters implementation. No code fences (signatures go under シンボル as plain text).

```markdown
**ゴール:** （1文。完成後の状態だけ。ステップ列挙禁止）
**チェック:** （1文。観測できる完了条件だけ。例: Surfaceで… / pnpm test:run で…が green）

**ステップ:**（3–7）

1. （動詞で始まる到達点・1行。ファイル名禁止）
   - **ファイル:** `path`（`new`|`edit`）を列挙するだけ。説明禁止
   - **シンボル:** コード表記のみ・1行に1つ。説明禁止
   - **フロー:** `→` でつないだ短い節だけ（3–6個）。実装詳細・コード禁止
   - **チェック:** このステップの観測1文。無ければ行ごと省略（空の「チェック:」禁止）

2. …
```

| Field             | Write                                             | Do not write                |
| ----------------- | ------------------------------------------------- | --------------------------- |
| ゴール            | slice end state, one sentence                     | a preview of the step list  |
| チェック（slice） | how to observe done                               | vague “it works”            |
| ステップ名        | verb + outcome                                    | file name as the title      |
| ファイル          | path + `new`/`edit` only                          | why that file               |
| シンボル          | types / components / fns / args as code-like text | Japanese prose              |
| フロー            | data or UI path as `→` chain                      | full algorithm, code fences |
| チェック（step）  | observe **this** beat only                        | copy of the slice チェック  |

Close with a cue that the learner can ask by number for a Deep Dive.

#### 2 — Deep Dive

When the learner asks about a Digest step (by number or stuck on one), teach **that** — short and concrete. About one short Udemy lecture of focus when they are implementing; shorter when the ask is smaller. Do not re-dump the whole Digest unless they ask to reorient.

No fixed heading template (no mandatory ゴール / ポイント / ガイド). Do not invent mode switches for “実装 vs 用語” — answer what they asked.

When code helps, show **partial / focused** snippets in write order (not full files), each followed by a short `これは…` paragraph. When code does not help, a short explanation is enough. Stay inside the current slice’s Test / Surface policy.

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

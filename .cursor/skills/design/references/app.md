# app

## Principle

The screen is not a prototype — it's a thinking surface. Components are written production-ready from the start. Hardcoded data only. The conversation around the screen produces the real output: `# Screen` (Default + All component matrices), `# Grain` / `# Tokens` (via `grain`), and the slice plan in the Design issue body.

- Data is realistic and covers edge cases: very long strings, very short strings, missing optional fields, zero counts, mixed statuses, special characters
- CSS hover/focus/active styles are included as normal — these are part of the component, not separate states
- Interactive behavior (clicks, modals opening, drag-and-drop) is not implemented — the screen is static. **Except for what CSS can do.**
- The goal is to see the layout, hierarchy, typography, spacing, and component structure in a realistic condition
- Scope of the thinking surface is the **default / home screen only**

`prototype/` is disposable. It exists to bootstrap alignment, not to be maintained. Once the product is working, the product is the source of truth — not the Design issue body, not the default screen. Delete `prototype/` when the product can speak for itself.

A **slice** is a vertical user-facing concern used as **build order** after the Default matrix exists. One slice includes the components for that concern, the screen composition update, and comment blocks.

---

## Stages

Do not slice before the Default matrix. Do not fill All matrix before building.

### 1. Analyze

Read `package.json` and config files. Determine the prototype location and the components directory.

**File-routing frameworks** (Next.js App Router, SvelteKit, Nuxt, Remix, etc.)
→ `prototype/index.tsx` inside the routing root (e.g., `app/prototype/index.tsx` for App Router).

**Non-routing setups** (Vite + React, Vite + Vue, plain HTML, etc.)
→ `src/prototype/index.tsx` or `prototype/index.html` at project root

Components live in the appropriate components directory (e.g., `components/`, `src/components/`).

Agree the locations in chat. No issue write required for Analyze alone.

### 2. Grain Define

If `# Grain` in the Design issue is empty, invoke **`grain`** — **Mode — Define**. Persist `# Grain` and `# Tokens` via `issue` after user agreement (milestone). Skip if `# Grain` is already filled.

Details: `.cursor/skills/grain/SKILL.md` — do not duplicate Define flow here.

### 3. Default Component Matrix (plan)

From Spec + Grain, list what belongs on the **default screen only**. Thin columns are enough:

| File | Role |
| ---- | ---- |

Show in chat; agree yes / edit / no. Persist at a milestone (often with Grain, or at session end) — not after every tweak.

Do **not** invent build order here. Do **not** fill All / Implementation matrices yet.

### 4. Slices (build order)

Looking at the agreed Default matrix, decide **in what order** to build. Group related components into slices by user-facing concern.

**Example (task app):**

- Slice 1: Chrome (Header + Footer + index placeholder)
- Slice 2: Browse tasks (TaskList + TaskItem + EmptyState)
- Slice 3: Add task (AddTaskModal)

**Common groupings:** view concern / create concern / edit-delete concern / detail concern.

Agree the checklist in chat. Persist `## Slices` under `# Plan` at a milestone (session end is fine).

### 5. Build slices

One slice at a time, with user agreement between slices. For each slice:

1. Confirm the slice in chat
2. Caller follows `rules` (after rules handshake)
3. Write components in production location; compose on the default screen
4. Browser-check when useful
5. Optionally thicken Default matrix rows (states / variants) in chat — **issue persist at session end**, not every slice

During build, invoke **`grain`** Audit / Improve when the surface drifts.

### 6. Close inventory

After slices for the default screen are done:

1. Reconcile **Default Component Matrix** with what the prototype actually contains (File / Default / States / Variants as needed)
2. Fill **All Component Matrix** — everything the product needs, including components **not** built on the thinking surface
3. Fill **Implementation Matrix** — hooks / APIs / files discussed but not prototyped
4. Agree in chat; persist once via `issue`; Design may close

---

## Design protocol

### Components

Write components in their production location from the start — not under `prototype/`.

**Existing project** — import from wherever real components live.

**Greenfield project** — create in the appropriate components directory. The prototype imports them from there.

### Default screen

Write the screen exactly as it would look in production. Keep the DOM structure as close to production as possible — no extra wrapper divs.

Add `data-component="ComponentName"` directly to the root element of each component. This creates a shared vocabulary — both agent and user refer to components by this name. The user can find any element instantly in DevTools by searching the attribute value. This attribute stays in production code — it is useful for debugging and costs nothing.

```tsx
// components/header.tsx
export function Header({ user }) {
  return <header data-component="Header">...</header>;
}
```

```tsx
// prototype/default.tsx
import { Header } from "../components/header";
import { TaskList } from "../components/task-list";
import { Footer } from "../components/footer";

export default function DefaultScreen() {
  const tasks = [
    {
      id: 1,
      title: "Review Q3 report",
      status: "in-progress",
      assignee: "Yuki",
    },
    { id: 2, title: "Update roadmap", status: "todo", assignee: null },
    // edge case: very long title
    {
      id: 3,
      title:
        "Migrate legacy authentication system to OAuth 2.0 and update all dependent services",
      status: "todo",
      assignee: "Park",
    },
    // edge case: done, no assignee
    { id: 4, title: "Send digest", status: "done", assignee: null },
  ];

  return (
    <>
      <Header user={{ name: "Yuki", avatar: "/avatar.png" }} />
      <main>
        <TaskList tasks={tasks} />
      </main>
      <Footer />
    </>
  );
}
```

### Hardcoded data rules

- Use realistic values — not "lorem ipsum" or "Item 1, Item 2"
- Cover edge cases: very long strings, very short strings, missing optional fields, zero counts, large numbers, mixed states
- Define data inline in the screen file — no shared fixtures
- Do not fetch data, use state, or add event handlers

### Component comment format

Every component file gets a structured comment block at the top. Do not skip or abbreviate — this is the spec for the build phase.

```tsx
// [ComponentName]
//
// 役割:
//   - このコンポーネントが何をするか1〜2行で
//
// 状態:
//   - stateName[, stateName2, ...][: 補足説明]
//   例:
//     - default
//     - open, closed: モーダルの開閉
//     - submitting: 送信処理中(spinner 表示)
//   該当なければ「なし」と書く
//
// バリアント:
//   |        | primary | secondary | danger | success | warning | info | n/a |
//   | 該当✓ |         |           |        |         |         |      |     |
//   - バリアントで補足が必要なら箇条書きで(例: primary: メイン CTA)
//
// Props:
//   - propName: 型 — 説明(propName? で任意)
//   例:
//     - userId: string — ユーザー ID
//     - variant?: 'primary' | 'secondary' — ボタンバリアント(任意、デフォルト 'primary')
//
// インタラクション:
//   - on{Event}: 動作
//   イベント: click / doubleClick / hover / focus / blur / change / input / submit / drag / drop / scroll / keydown / keyup
//   例: - onClick: クリックでフォーム送信
//   該当なければ「なし」と書く
//
// Uses:
//   - {fileType}:{path}({function}) — 用途
//   fileType: hook / api / service / lib
//   例: - hook:hooks/useTasks.ts(useTasks) — task 一覧取得
//   使わなければ「なし」と書く
//
// 考慮事項:
//   - 任意の free-form メモ(a11y / perf / edge case / security / design / i18n 等)
//   例:
//     - a11y: aria-label 設定、Tab フォーカス順序
//     - perf: 1000+ タスク時の仮想スクロール検討
//     - design: キャンセル動作は ESC キーでも可能にする
//   該当なければ「なし」と書く
```

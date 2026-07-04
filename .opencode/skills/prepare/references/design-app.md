# design-app

**These are the rules and protocol one should be aware of before beginning implementaion on the session.**

Build a realistic default screen using production-ready components to align on design direction and clarify what needs to be built. The screen is the discussion tool. The real deliverable is the spec that comes out of the conversation.

## Principle

The screen is not a prototype — it's a thinking surface. Components are written production-ready from the start. Hardcoded data only. One screen: default. The conversation around the screen produces the real output: a component matrix and a minimal style guide in `spec.md`.

`prototype/` is disposable. It exists to bootstrap alignment, not to be maintained. Once the product is working, the product is the source of truth — not `spec.md`, not the default screen. Delete `prototype/` when the product can speak for itself.

---

## Step 1 — Build the default screen

Without asking for further input, make reasonable design decisions and build the default screen.

### What "default" means

The default screen is the standard loaded state a typical user sees after the app has data. It is not a demo screen and not a best-case scenario — it is a realistic, slightly messy snapshot of the app in normal use.

- Data is realistic and covers edge cases: very long strings, very short strings, missing optional fields, zero counts, mixed statuses, special characters
- CSS hover/focus/active styles are included as normal — these are part of the component, not separate states
- Interactive behavior (clicks, modals opening, drag-and-drop) is not implemented — the screen is static
- The goal is to see the layout, hierarchy, typography, spacing, and component structure in a realistic condition

### Stack detection

Read `package.json` and config files. Then:

**File-routing frameworks** (Next.js App Router, SvelteKit, Nuxt, Remix, etc.)
→ `prototype/default` inside the routing root

**Non-routing setups** (Vite + React, Vite + Vue, plain HTML, etc.)
→ `src/prototype/default` or `prototype/default.html` at project root

### Directory structure

```
prototype/
  default.tsx    ← the only screen
  spec.md        ← generated at the end
```

### Components

Write components in their production location from the start — not under `prototype/`.

**Existing project** — import from wherever real components live.

**Greenfield project** — create in the appropriate components directory. The prototype imports them from there.

### Writing the default screen

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
// 状態/バリアント:
//   - default: 通常表示
//   - empty: データなし（該当する場合）
//   - loading: ローディング中（該当する場合）
//   - error: エラー時（該当する場合）
//   - その他アプリ固有の状態
//
// Props / データ:
//   - propName: 型 — 説明
//   - propName?: 型 — 説明（オプション）
//
// productでのインタラクション:
//   - ユーザーが何をできるか（クリック、ドラッグ、入力など）
//   - 該当なければ「なし」と書く
//
// TODO (本番実装時):
//   - データ取得: どのようなAPIやフックを使うと想定されるか
//   - イベント: どのようなハンドラが必要と想定されるか
//   - その他実装上の注意
```

---

## Step 2 — Discuss and iterate

Ask the user to open the screen in the browser. Then discuss freely — design, layout, components, data, anything. Edit the screen based on feedback.

Refer to components by their `data-component` name. If feedback is ambiguous, ask which component it applies to.

Continue until the screen feels right.

---

## Step 3 — Identify missing components

After the default screen is aligned, propose components that are necessary for the app but absent from the default screen. Present this as a chat list with reasoning — do not use question tools.

Use this list as a thinking prompt. Not all will apply — propose only what makes sense for this app.

**Data states**

- Empty state — no items; layout and call-to-action differ significantly from default
- Error state — fetch failed; error message replaces content
- Offline state — no connection

**Surfaces triggered by interaction**

- Creation modal or form
- Edit mode — inline or full form
- Delete confirmation dialog
- Detail panel or drawer

**Structural variants**

- Collapsed / expanded sections
- Search results — especially zero-results
- Filtered view — if structure changes significantly
- Multi-selection mode — bulk action toolbar

**Access and permission states**

- Guest / unauthenticated view
- Read-only view
- No permission screen

**Onboarding**

- First-run experience

These components are added to the component matrix in `spec.md` — they are not built as additional screens.

---

## Step 4 — Generate spec.md

When the screen and component list are aligned, generate `prototype/spec.md`.

```markdown
# Design Spec

Generated from app-design-align session.

## Style Guide

| Token        | Value             |
| ------------ | ----------------- |
| Primary      | #3B82F6           |
| Background   | #F9FAFB           |
| Text         | #111827           |
| Border       | #E5E7EB           |
| Radius       | 8px               |
| Font         | Inter, sans-serif |
| Base size    | 14px              |
| Spacing unit | 4px               |

## Component Matrix

| Component   | File             | States / Variants       | Props                    | Interactions          | In default | TODOs                    |
| ----------- | ---------------- | ----------------------- | ------------------------ | --------------------- | ---------- | ------------------------ |
| Header      | header.tsx       | default, guest          | user: { name, avatar }   | -                     | true       | fetch current user       |
| TaskList    | task-list.tsx    | default, empty, loading | tasks[]                  | drag to reorder       | true       | useTasks hook            |
| TaskItem    | task-item.tsx    | todo, in-progress, done | task: { id, title, ... } | status change, delete | true       | onStatusChange, onDelete |
| Footer      | footer.tsx       | -                       | -                        | -                     | true       | -                        |
| CreateModal | create-modal.tsx | open, error             | onSubmit, onClose        | form submit, close    | false      | POST /tasks              |
| EmptyState  | empty-state.tsx  | -                       | onCreateClick            | create first item     | false      | -                        |
```

---

## Step 5 — Hand off

`prototype/` stays in the repo as an alignment snapshot for the duration of the early build phase.

**If a significant design change comes up during the build** — delete `prototype/` and run app-design-align again from scratch. Do not version or accumulate screens inside `prototype/`. Each run is disposable and self-contained.

**If a small change comes up** — modify the product directly. Update `spec.md` by hand if it still matters. Do not re-run app-design-align for minor adjustments.

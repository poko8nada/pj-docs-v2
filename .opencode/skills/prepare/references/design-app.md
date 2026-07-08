# design-app

**These are the rules and protocol one should be aware of before beginning implementaion on the session.**

Build a realistic default screen using production-ready components to align on design direction and clarify what needs to be built. The screen is the discussion tool. The real deliverable is the spec that comes out of the conversation, stored in the [Design] issue body.

## Principle

The screen is not a prototype — it's a thinking surface. Components are written production-ready from the start. Hardcoded data only. One screen: default. The conversation around the screen produces the real output: a component matrix and a minimal style guide in the [Design] issue body.

`prototype/` is disposable. It exists to bootstrap alignment, not to be maintained. Once the product is working, the product is the source of truth — not the design spec (which lives in the [Design] issue body), not the default screen. Delete `prototype/` when the product can speak for itself.

---

## Step 1 — Build the default screen

Without asking for further input, make reasonable design decisions and build the default screen.

### What "default" means

The default screen is the standard loaded state a typical user sees after the app has data. It is not a demo screen and not a best-case scenario — it is a realistic, slightly messy snapshot of the app in normal use.

- Data is realistic and covers edge cases: very long strings, very short strings, missing optional fields, zero counts, mixed statuses, special characters
- CSS hover/focus/active styles are included as normal — these are part of the component, not separate states
- Interactive behavior (clicks, modals opening, drag-and-drop) is not implemented — the screen is static. **Except for what CSS can does.**
- The goal is to see the layout, hierarchy, typography, spacing, and component structure in a realistic condition

### Stack detection

Read `package.json` and config files. Then:

**File-routing frameworks** (Next.js App Router, SvelteKit, Nuxt, Remix, etc.)
→ `prototype/index.tsx` inside the routing root (e.g., `app/prototype/index.tsx` for App Router).

**Non-routing setups** (Vite + React, Vite + Vue, plain HTML, etc.)
→ `src/prototype/index.tsx` or `prototype/index.html` at project root

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

---

## Step 2 — Discuss and iterate

Ask the user to open the screen in the browser. Then discuss freely — design, layout, components, data, anything. Edit the screen based on feedback.

Refer to components by their `data-component` name. If feedback is ambiguous, ask which component it applies to.

Continue until the screen feels right.

---

## Step 3 — Identify missing components and logic

After the default screen is aligned, identify what's missing in two layers. Present as a chat list with reasoning — do not use question tools.

### Components

UI files (`components/*.tsx`) absent from the default screen.

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

### Logic

Non-component files (hooks, API routes, services) that the components depend on. For each, identify:

- **File path** — full path from project root (e.g., `hooks/useTasks.ts`, `api/tasks/[id]/route.ts`)
- **Functions** — what the file exports (hooks, route handlers, service methods)
- **API** — what endpoints or DB queries the file handles

Use this list as a thinking prompt. Not all will apply — propose only what makes sense for this app.

**Hooks** (client-side data fetching)

- `useTasks` — list, create, update, delete
- `useUser` — current user

**API routes** (server-side handlers)

- `GET /tasks` — list tasks
- `POST /tasks` — create task
- `PATCH /tasks/:id` — update task
- `DELETE /tasks/:id` — delete task

These populate the **Component Matrix** and **Implementation Matrix** in the [Design] issue body — they are not built as additional screens.

---

## Step 4 — Update [Design] issue body

The design spec lives in the [Design] issue body — not in a local file. Throughout the design phase, keep the body up to date. Each time the design conversation changes a decision, reflect it in the body before the next user turn.

### Body structure (app)

```markdown
# Design Spec

Generated from app-design-align session.

## Style Guide

| Token      | Value   | Use                         |
| ---------- | ------- | --------------------------- |
| Brand      | #3B82F6 | app theme, primary CTA      |
| Background | #F9FAFB | app background              |
| Surface    | #FFFFFF | cards, sheets               |
| Text       | #111827 | foreground                  |
| Muted      | #6B7280 | secondary text, placeholder |
| Border     | #E5E7EB | dividers, input borders     |
| Success    | #10B981 | success states, badges      |
| Warning    | #F59E0B | warning states, alerts      |
| Error      | #EF4444 | error states, validation    |
| Info       | #3B82F6 | info states, hints          |

## Component Matrix

| File             | Default | States                   | Variants                      |
| ---------------- | ------- | ------------------------ | ----------------------------- |
| header.tsx       | ✓       | default, guest           | —                             |
| footer.tsx       | ✓       | —                        | —                             |
| task-list.tsx    | ✓       | default, empty, loading  | —                             |
| task-item.tsx    | ✓       | todo, in-progress, done  | —                             |
| create-modal.tsx | —       | open, error              | —                             |
| empty-state.tsx  | —       | —                        | —                             |
| button.tsx       | ✓       | default, hover, disabled | primary, secondary, danger    |
| input.tsx        | —       | default, focus, error    | text, password                |
| badge.tsx        | ✓       | —                        | success, warning, error, info |
| toast.tsx        | —       | visible, hidden          | success, warning, error, info |

## Implementation Matrix

| File                      | Functions              | API                      |
| ------------------------- | ---------------------- | ------------------------ |
| `hooks/useTasks.ts`       | useTasks               | GET /tasks               |
| `hooks/useUser.ts`        | useUser                | GET /me                  |
| `api/tasks/route.ts`      | listTasks, createTask  | GET, POST /tasks         |
| `api/tasks/[id]/route.ts` | updateTask, deleteTask | PATCH, DELETE /tasks/:id |
```

### Update procedure

1. Compose the full body in a heredoc and pass via `gh issue edit <design_number> --body "$(cat <<'EOF' ... EOF)"`.
2. Do not skip sections. Every section in the structure above must be present in the final body, even with `(none)` for empty entries.

See `issue/references/commands.md` for the exact `gh` invocation.

---

## Step 5 — Hand off

`prototype/` stays in the repo as an alignment snapshot for the duration of the early build phase.

**If a significant design change comes up during the build** — delete `prototype/` and run app-design-align again from scratch. Do not version or accumulate screens inside `prototype/`. Each run is disposable and self-contained.

**If a small change comes up** — modify the product directly. Update the [Design] issue body by hand if it still matters. Do not re-run app-design-align for minor adjustments.

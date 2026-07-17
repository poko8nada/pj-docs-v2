# design-app

**These are plans that must be prepared prior to implementation, requiring the creation of specific deliverables.  
They also represent rules and procedures that must be understood before implementation begins.**

Build a realistic default screen using production-ready components to align on design direction and clarify what needs to be built. The screen is the discussion tool. The real deliverable is the spec that comes out of the conversation, stored in the [Design] issue body.

## Principle

The screen is not a prototype — it's a thinking surface. Components are written production-ready from the start. Hardcoded data only. The conversation around the screen produces the real output: a component matrix and a minimal style guide in the [Design] issue body.

- Data is realistic and covers edge cases: very long strings, very short strings, missing optional fields, zero counts, mixed statuses, special characters
- CSS hover/focus/active styles are included as normal — these are part of the component, not separate states
- Interactive behavior (clicks, modals opening, drag-and-drop) is not implemented — the screen is static. **Except for what CSS can does.**
- The goal is to see the layout, hierarchy, typography, spacing, and component structure in a realistic condition

`prototype/` is disposable. It exists to bootstrap alignment, not to be maintained. Once the product is working, the product is the source of truth — not the design spec (which lives in the [Design] issue body), not the default screen. Delete `prototype/` when the product can speak for itself.

---

## Prepare

The prepare workflow consists of 5 steps.

### Step 1: Analyze

Read `package.json` and config files. Determine the prototype location and the components directory.

**File-routing frameworks** (Next.js App Router, SvelteKit, Nuxt, Remix, etc.)
→ `prototype/index.tsx` inside the routing root (e.g., `app/prototype/index.tsx` for App Router).

**Non-routing setups** (Vite + React, Vite + Vue, plain HTML, etc.)
→ `src/prototype/index.tsx` or `prototype/index.html` at project root

Components live in the appropriate components directory (e.g., `components/`, `src/components/`).

### Step 2: Identify slices

Think about what the user sees on the default screen. Group related components into slices by user-facing concern.

**Example (task app):**

- Slice 1: Chrome (Header + Footer + index.tsx placeholder)
- Slice 2: Browse tasks (TaskList + TaskItem + EmptyState)
- Slice 3: Add task (AddTaskModal)

**Common slice groupings:**

- View concern: list + items + empty state
- Create concern: form + modal + submit button
- Edit/delete concern: edit mode + confirm dialog
- Detail concern: detail panel or drawer

### Step 3: Display

Show the proposed slice list in chat. Also show the initial Style Guide values and Component Matrix (with placeholder states/variants) for the user to review.

### Step 4: User agreement

Use the `question` tool to surface a yes / edit / no decision on the plan.

- **yes** — the plan is locked. Proceed to Step 5.
- **edit** — the user provides specific edits. Update the plan and ask again.
- **no** — the plan is rejected. Return to Step 2 with the user's feedback.

### Step 5: Write to body

After the user agrees, write the plan and initial spec to the issue body.

**Filled in Step 5:**

- `## Slices` section (plan): the slice list as checkboxes (all `[ ]`)
- `## Style Guide` (under `# Design Spec`): initial values (Color, Typography, Spacing)
- `## Component Matrix`: components for the default screen, placeholder states/variants

**NOT filled in Step 5 (left as `(none)` or empty):**

- `## Implementation Matrix`: filled when discussed during run (hook/API decisions often emerge from discussing the design)

The body structure after Step 5:

```markdown
... existing plan sections (Goal, Reference, What, Constraints) ...

## Slices

- [ ] Slice 1: Chrome
- [ ] Slice 2: Browse tasks
- [ ] Slice 3: Add task

---

# Design Spec (app)

## Style Guide

| Token | Value | Use |
| Brand | #3B82F6 | app theme, primary CTA |
| ... (initial values)

## Component Matrix

| File | Default | States | Variants |
| header.tsx | ✓ | default | — |
| ... (placeholder states for default screen components)

## Implementation Matrix

(none — to be filled after discuss / slices)

---

# Design Progress

## Slices

- [ ] Slice 1: Chrome
- [ ] Slice 2: Browse tasks
- [ ] Slice 3: Add task

## Notes
```

See `issue/references/commands.md` for the exact `gh issue edit` invocation.

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

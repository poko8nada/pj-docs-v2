# design-web

**These are the rules and protocol one should be aware of before beginning implementation on the session.**

Build a realistic default screen using production-ready components to align on design direction and clarify what needs to be built. The screen is the discussion tool. The real deliverable is the spec that comes out of the conversation.

## Principle

The screen is not a prototype — it's a thinking surface. Components are written production-ready from the start. Hardcoded data only. The conversation around the screen produces the real output: a page structure, a section matrix, and a style guide in the [Design] issue body.

`prototype/` is disposable. It exists to bootstrap alignment, not to be maintained. Once the product is working, the product is the source of truth — not the design spec (which lives in the [Design] issue body), not the default screen. Delete `prototype/` when the product can speak for itself.

## How this is structured

This file describes the design prepare workflow. Prepare produces a plan (slice list) and writes it to the body. The number of slices is variable, decided during prepare based on the project's user-facing concerns.

A **slice** is a vertical user-facing concern. For example, in a landing page, "Hero" and "Features" are slices. A slice is not a single section — it includes all sections for that concern, plus the index.tsx update to compose them.

---

## Prepare

The prepare workflow consists of 5 steps.

### Step 1: Analyze (web type + stack)

**Web type confirmation:**

The web type was discussed during Context & Understanding. Confirm it now before building:

| Type                | Description                                             |
| ------------------- | ------------------------------------------------------- |
| **Large site**      | Complex navigation, multiple page types, search/filters |
| **Small corporate** | Simple, few pages, contact form                         |
| **Blog**            | Content-focused, reading experience                     |
| **Landing page**    | Single-page, conversion-focused                         |
| **Documentation**   | Hierarchical structure, code examples                   |

**Stack detection:**

Read `package.json` and config files. Determine the prototype location.

**File-routing frameworks** (Next.js App Router, SvelteKit, Nuxt, Remix, etc.)
→ `prototype/index.tsx` inside the routing root.

**Non-routing setups** (Vite + React, Vite + Vue, plain HTML, etc.)
→ `src/prototype/index.tsx` or `prototype/index.html`

Sections/components live in the appropriate directory (e.g., `components/`, `sections/`).

### Step 2: Identify slices

Think about what the user sees on the default screen (top page). Group related sections into slices by user-facing concern.

**Examples by web type:**

**Landing page:**

- Slice 1: Chrome (Header + Footer + index.tsx placeholder)
- Slice 2: Hero
- Slice 3: Features
- Slice 4: Social proof (Testimonials + Logos)
- Slice 5: Conversion (CTA)

**Blog:**

- Slice 1: Chrome (Header + Footer + index.tsx)
- Slice 2: Post list (PostList + Sidebar)
- Slice 3: Post detail (PostDetail)

**Small corporate:**

- Slice 1: Chrome (Header + Footer + index.tsx)
- Slice 2: Story
- Slice 3: Team
- Slice 4: Contact (Form + Map)

A 1:1 section-to-slice mapping is too fine. A "all sections per slice" mapping is too coarse. Aim for one slice per user-facing concern.

**Component comment format (apply to every section/component written in any slice):**

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
//     - open, closed: メニュー/アコーディオン開閉
//   該当なければ「なし」と書く
//
// バリアント:
//   |        | primary | secondary | danger | n/a |
//   | 該当✓ |         |           |        |     |
//   - バリアントで補足が必要なら箇条書きで
//
// Props:
//   - propName: 型 — 説明(propName? で任意)
//   例:
//     - title: string — 見出し
//     - children: ReactNode
//
// インタラクション:
//   - on{Event}: 動作
//   イベント: click / hover / focus / submit / scroll / keydown
//   例: - onClick: ナビゲーション遷移
//   該当なければ「なし」と書く
//
// 考慮事項:
//   - 任意の free-form メモ(a11y / SEO / perf / edge case / browser 等)
//   例:
//     - a11y: aria-label、Tab フォーカス順序
//     - SEO: 適切な見出しレベル、alt 属性
//   該当なければ「なし」と書く
```

### Step 3: Display

Show the proposed slice list in chat. Also show the initial Style Guide values, Section Matrix (with placeholder layouts), and confirmed Web Type for the user to review.

### Step 4: User agreement

Use the `question` tool to surface a yes / edit / no decision on the plan.

- **yes** — the plan is locked. Proceed to Step 5.
- **edit** — the user provides specific edits. Update the plan and ask again.
- **no** — the plan is rejected. Return to Step 2 with the user's feedback.

### Step 5: Write to body

After the user agrees, write the plan and initial spec to the issue body.

**Filled in Step 5:**

- `## Web Type` (under `# Design Spec`): confirmed type
- `## Style Guide`: initial values (Color, Typography, Spacing)
- `## Section Matrix`: sections for the default screen, placeholder layouts/parts
- `## Slices` section (plan): the slice list as checkboxes (all `[ ]`)

**NOT filled in Step 5 (left as `(none)` or empty):**

- `## Page Structure`: filled when the user mentions additional pages (often emerges during run)
- `## Implementation Matrix`: filled when discussed (hook/API decisions often emerge from discussing the design)

The body structure after Step 5:

```markdown
... existing plan sections (Goal, Reference, What, Constraints) ...

## Slices

- [ ] Slice 1: Chrome
- [ ] Slice 2: Hero
- [ ] Slice 3: Features
- [ ] Slice 4: Social proof
- [ ] Slice 5: Conversion

---

# Design Spec (web)

## Web Type

Landing page (or whichever type was confirmed)

## Style Guide

| Token | Value | Use |
| ... (initial values)

## Section Matrix

| Section | Layout (PC) | Layout (Mobile) | Main parts |
| ... (placeholder layouts for default screen sections)

## Page Structure

(none — to be filled after discuss / slices)

## Implementation Matrix

(none — to be filled after discuss / slices)

---

# Design Progress

## Slices

- [ ] Slice 1: Chrome
- [ ] Slice 2: Hero
- [ ] Slice 3: Features
- [ ] Slice 4: Social proof
- [ ] Slice 5: Conversion

## Notes
```

See `issue/references/commands.md` for the exact `gh issue edit` invocation.

---

## Slices

Each slice is executed one at a time, with user confirmation between slices. For each slice:

1. Read the slice from the body
2. Write the sections in the slice to production location (with `data-component` and comment block)
3. Update `index.tsx` to compose the new sections
4. Present a confirm message (changed files, verification result)

### Slice 1: Chrome (Header + Footer + index.tsx)

The first slice is always the page shell.

**Done condition:**

- `Header` section exists in production location, with `data-component="Header"`, with comment block
- `Footer` section exists in production location, with `data-component="Footer"`, with comment block
- `index.tsx` exists, renders Header + Footer + a placeholder for the main area
- Hardcoded data covers edge cases

**What "default" means:**
The default screen is the top page of the site. The goal is to agree on the visual direction of this top page before expanding to additional pages.

- Build with header, footer, and key content sections
- Header, footer, and sidebar are not placeholders — build them with production-level style
- Focus on typography, spacing, colors, and visual hierarchy
- Responsive design is required for all sections
- Interactive behavior is not implemented — the screen is static. Except for what CSS can do.

**Hardcoded data rules (apply to all slices):**

- Use realistic values — not "lorem ipsum" or "Item 1, Item 2"
- Cover edge cases: very long strings, very short strings, missing optional fields, zero counts, large numbers, mixed states
- Define data inline in the screen file — no shared fixtures
- Do not fetch data, use state, or add event handlers

**Writing sections/components:**

- Write in production location, not under `prototype/`
- Add `data-component="ComponentName"` on the root element

```tsx
// components/header.tsx
export function Header({ siteName, nav }) {
  return <header data-component='Header'>...</header>;
}
```

**Writing the default screen:**

```tsx
// prototype/index.tsx
import { Header } from '../components/header';
import { Footer } from '../components/footer';

export default function DefaultScreen() {
  return (
    <>
      <Header siteName='Acme' nav={[{ label: 'Home', href: '/' }]} />
      <main>{/* Feature slices will fill this */}</main>
      <Footer />
    </>
  );
}
```

### Slices 2..N: Feature slices

Each feature slice adds one user-facing concern. The slice is **vertical**: it includes all sections for that concern, plus the index.tsx update to compose them, plus the comment blocks for each section.

**Done condition (per slice):**

- Each section for the concern exists in production location, with `data-component`, with comment block
- The index.tsx is updated to include the new sections in the main area
- Hardcoded data for the concern covers edge cases
- The screen renders and shows the concern working in the default state

---

## Between slices

Between slices (or after some slices), the user can:

- Discuss in chat (the agent responds, may edit the screen or the plan)
- Make decisions that affect the spec (style values, additional pages, hooks/APIs)

---

## Done condition (overall)

The design phase is done when:

- All slices are marked `[x]` in `# Design Progress` / `## Slices`
- All spec sections are filled (Web Type, Style Guide, Section Matrix, Page Structure, Implementation Matrix)
- The screen renders correctly in the browser
- The user has confirmed the design direction

After all of the above, close the [Design] issue and post a `## Design完了: <title>` comment on the [Spec] issue. See `.opencode/skills/issue/SKILL.md` for the comment format.

`prototype/` stays in the repo as an alignment snapshot for the duration of the early build phase.

**If a significant design change comes up during the build** — delete `prototype/` and run web-design-align again from scratch. Do not version or accumulate screens inside `prototype/`. Each run is disposable and self-contained.

**If a small change comes up** — modify the product directly. Update the [Design] issue body by hand if it still matters. Do not re-run web-design-align for minor adjustments.

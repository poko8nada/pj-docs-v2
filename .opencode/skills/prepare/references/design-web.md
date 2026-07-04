# design-web

**These are the rules and protocol one should be aware of before beginning implementation on the session.**

Build a realistic default screen using production-ready components to align on design direction and clarify what needs to be built. The screen is the discussion tool. The real deliverable is the spec that comes out of the conversation.

## Principle

The screen is not a prototype — it's a thinking surface. Components are written production-ready from the start. Hardcoded data only. One screen: default. The conversation around the screen produces the real output: a component matrix and a minimal style guide in `spec.md`.

`prototype/` is disposable. It exists to bootstrap alignment, not to be maintained. Once the product is working, the product is the source of truth — not `spec.md`, not the default screen. Delete `prototype/` when the product can speak for itself.

---

## Step 1 — Determine the web type

The web type was discussed during Context & Understanding. Confirm it now before building:

| Type                | Description                                             |
| ------------------- | ------------------------------------------------------- |
| **Large site**      | Complex navigation, multiple page types, search/filters |
| **Small corporate** | Simple, few pages, contact form                         |
| **Blog**            | Content-focused, reading experience                     |
| **Landing page**    | Single-page, conversion-focused                         |
| **Documentation**   | Hierarchical structure, code examples                   |

If the type is still unclear, ask the user briefly. Do not re-open the full discussion — that happened in prepare Step 2.

## Step 2 — Build the default screen

Without asking for further input, make reasonable design decisions and build the default screen based on the determined type.

### What "default" means

The default screen is the top page of the site. Unlike apps, web design alignment focuses on **style** rather than interaction. The goal is to agree on the visual direction — header, footer, sidebar (if applicable), hero section, and text sections.

- Build the top page with header, footer, and key content sections
- Header, footer, and sidebar are not placeholders — build them with production-level style
- Focus on typography, spacing, colors, and visual hierarchy
- Responsive design is required for all sections
- Interactive behavior is not implemented — the screen is static
- The real deliverable is style agreement and a component list

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

### Pages

Write pages in their production location from the start — not under `prototype/`.

**Existing project** — import from wherever real pages live.

**Greenfield project** — create in the appropriate pages directory. The prototype imports them from there.

### Type-specific screens

#### Large site

Build the homepage with:

- Global navigation (mega menu or multi-level)
- Hero section
- Content sections representing key areas
- Footer with site map

Focus on navigation hierarchy and content density.

#### Small corporate

Build the homepage with:

- Simple header with logo and nav
- Hero or main message
- Services/features overview
- Contact section or CTA
- Footer

Focus on clarity and trust signals.

#### Blog

Build the index/list page with:

- Header with site title and nav
- Post list with title, excerpt, date, author
- Sidebar (optional): categories, recent posts, about
- Footer

Focus on readability and content hierarchy.

#### Landing page

Build the full single page with:

- Hero with headline and primary CTA
- Features/benefits section
- Social proof (testimonials, logos, stats)
- Secondary CTA or pricing
- Footer

Focus on conversion flow and visual storytelling.

#### Documentation

Build the main doc page with:

- Sidebar navigation (table of contents)
- Content area with headings, code blocks, prose
- Search (if applicable)
- Footer

Focus on content hierarchy and code readability.

### Writing the default screen

Write the screen exactly as it would look in production. Keep the DOM structure as close to production as possible — no extra wrapper divs.

Add `data-component="ComponentName"` directly to the root element of each component. This creates a shared vocabulary — both agent and user refer to components by this name. The user can find any element instantly in DevTools by searching the attribute value. This attribute stays in production code — it is useful for debugging and costs nothing.

```tsx
// components/header.tsx
export function Header({ siteName, nav }) {
  return <header data-component="Header">...</header>;
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
//   - その他固有の状態
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

## Step 3 — Discuss and iterate

Ask the user to open the screen in the browser. Then discuss freely — design, layout, sections, data, anything. Edit the screen based on feedback.

Refer to sections by their `data-component` name. If feedback is ambiguous, ask which section it applies to.

Continue until the screen feels right.

---

## Step 4 — Identify missing sections

After the default screen is aligned, propose sections that are necessary for the site but absent from the default screen. Present this as a chat list with reasoning — do not use question tools.

Use this list as a thinking prompt. Not all will apply — propose only what makes sense for this site.

**Navigation variants**

- Mobile navigation (hamburger, drawer)
- Breadcrumbs
- Pagination or infinite scroll
- Search overlay or dedicated search page

**Content states**

- Empty state — no results; layout and call-to-action differ significantly from default
- Error state — 404, 500 pages
- Loading state — skeleton screens

**Additional sections**

- Modal or lightbox (image view, form)
- Sidebar content (categories, filters)
- Testimonials or social proof
- FAQ or accordion

**Structural variants**

- Sidebar collapsed / expanded
- Filtered view — if structure changes significantly
- Multi-level navigation expanded

These sections are added to the page structure in `spec.md` — they are not built as additional screens.

---

## Step 5 — Generate spec.md

When the screen and section list are aligned, generate `prototype/spec.md`.

```markdown
# Design Spec

Generated from web-design-align session.

## Web Type

< Determined type: Large site / Small corporate / Blog / LP / Documentation >

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

## Page Structure

| Section | File       | Style Notes           | In default | TODOs      |
| ------- | ---------- | --------------------- | ---------- | ---------- |
| Header  | header.tsx | logo, nav alignment   | true       | responsive |
| Hero    | hero.tsx   | headline, CTA styling | true       | -          |
| Footer  | footer.tsx | links, copyright      | true       | -          |
```

---

## Step 6 — Hand off

`prototype/` stays in the repo as an alignment snapshot for the duration of the early build phase.

**If a significant design change comes up during the build** — delete `prototype/` and run web-design-align again from scratch. Do not version or accumulate screens inside `prototype/`. Each run is disposable and self-contained.

**If a small change comes up** — modify the product directly. Update `spec.md` by hand if it still matters. Do not re-run web-design-align for minor adjustments.

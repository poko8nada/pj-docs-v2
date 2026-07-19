# web

## Principle

The screen is not a prototype — it's a thinking surface. Components are written production-ready from the start. Hardcoded data only. The conversation around the screen produces the real output: `# Screen` (Default + All section matrices), `# Grain` / `# Tokens` (via `grain`), and the slice plan in the Design issue body.

`prototype/` is disposable. It exists to bootstrap alignment, not to be maintained. Once the product is working, the product is the source of truth — not the Design issue body, not the default screen. Delete `prototype/` when the product can speak for itself.

Scope of the thinking surface is the **default screen (top / home)** only. Additional pages belong in All inventory at close, not in early Prepare.

A **slice** is a vertical user-facing concern used as **build order** after the Default section matrix exists. One slice includes the sections for that concern, plus the index composition update, plus comment blocks.

---

## Stages

Do not slice before the Default matrix. Do not fill All matrix before building.

### 1. Analyze (web type + stack)

**Web type confirmation** (discussed in Context & Understanding; confirm before building):

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

Agree locations + Web Type in chat. No issue write required for Analyze alone.

### 2. Grain Define

If `# Grain` in the Design issue is empty, invoke **`grain`** — **Mode — Define**. Persist `# Grain` and `# Tokens` via `issue` after user agreement (milestone). Skip if `# Grain` is already filled.

Details: `.cursor/skills/grain/SKILL.md` — do not duplicate Define flow here.

### 3. Default Section Matrix (plan)

From Spec + Grain + Web Type, list what belongs on the **top / home screen only**. Thin columns are enough:

| Section | Role |
| ------- | ---- |

**Examples (default only):**

- Landing: Chrome, Hero, Features, Social proof, CTA
- Blog: Chrome, Post list (+ sidebar if on the list page) — **not** Post detail
- Small corporate: Chrome, Story, Team, Contact

Show in chat; agree yes / edit / no. Persist at a milestone. Off-default pages/sections wait for All matrix at close.

### 4. Slices (build order)

Looking at the agreed Default matrix, decide **in what order** to build.

**Example (landing):**

- Slice 1: Chrome (Header + Footer + index placeholder)
- Slice 2: Hero
- Slice 3: Features
- Slice 4: Social proof
- Slice 5: Conversion (CTA)

A 1:1 section-to-slice mapping is too fine; one giant slice is too coarse. Aim for one slice per user-facing concern.

Agree the checklist in chat. Persist `## Slices` at a milestone (session end is fine).

### 5. Build slices

One slice at a time, with user agreement between slices. For each slice:

1. Confirm the slice in chat
2. Caller runs `implement` (after implement handshake)
3. Write sections in production location; compose on the default screen
4. Responsive layout required; interactivity not implemented except CSS
5. Browser-check when useful
6. Optionally thicken Default matrix in chat — **issue persist at session end**, not every slice

Apply `# Grain` and `# Tokens`. Invoke **`grain`** Audit / Improve when the surface drifts.

**Hardcoded data rules:** realistic values; edge cases; inline in the screen file; no fetch, state, or event handlers.

**Writing sections:** production location; `data-component="Name"` on the root; structured comment block (same spirit as app — 役割 / 状態 / バリアント / Props / インタラクション / 考慮事項).

```tsx
// components/header.tsx
export function Header({ siteName, nav }) {
  return <header data-component="Header">...</header>;
}
```

```tsx
// prototype/index.tsx
import { Header } from "../components/header";
import { Footer } from "../components/footer";

export default function DefaultScreen() {
  return (
    <>
      <Header siteName="Acme" nav={[{ label: "Home", href: "/" }]} />
      <main>{/* Feature slices fill this */}</main>
      <Footer />
    </>
  );
}
```

**Slice 1 (Chrome)** is usually first: Header + Footer + index with a main placeholder.

### 6. Close inventory

After default-screen slices are done:

1. Reconcile **Default Section Matrix** with the prototype (layouts / parts as needed)
2. Fill **All Section Matrix** — product-wide sections needed, including ones **not** on the thinking surface (e.g. Blog Post detail)
3. Fill **Page Structure** and **Implementation Matrix** when relevant
4. Agree in chat; persist once via `issue`; Design may close

Record `## Web Type` under `# Screen` by close if not already persisted.

---

## Done condition (overall)

- Default-screen slices are done (checklist may be updated at session milestones)
- `# Grain`, `# Tokens`, and `# Screen` (Web Type, Default + All matrices, Page Structure / Implementation as needed) are filled — no `(TBD)` at close
- The default screen renders in the browser; user confirmed direction

After that, return to the caller for Design issue close / Spec lifecycle comments.

`prototype/` stays as an alignment snapshot early in forge. Significant redesign → delete `prototype/` and re-run this alignment. Small changes → edit the product directly.

---
name: visual-prototype
description: Use this skill when visual aspects come up in the conversation — color, atmosphere, reference apps, similar products, "what should this look like". Covers project initialization (greenfield, no components yet), adding a new screen or visual feature to an existing app, redesign of an existing screen, and any point where visual alignment is needed before building. Triggers on phrases like "I want it to feel like Linear", "mockup this", "what should this look like", "I want it more minimal", or when the agent senses the user wants to see something before committing to code. Builds a throwaway static visual mockup in the project's stack. Do NOT use for backend work, visual already locked in a written spec or external design file, or work already in the build phase.
compatibility: opencode
---

# Skill: visual-prototype

Build a throwaway static visual mockup in the project's stack to align on look and feel. The mockup is a single file with hardcoded values and no real functionality. The dev server and hot reload show every edit. The user reviews the rendered browser view, gives feedback, the agent edits, repeat.

## Principle

The mockup is an alignment snapshot, not a source of truth. It captures the look and feel at the moment of alignment. The real implementation evolves. When the visual direction changes, re-trigger this skill to refresh the snapshot.

In a greenfield project with no existing components, the mockup serves as the starting point — components are extracted from the mockup during the build phase. In a project with existing components, the mockup uses them so it matches the real build. When adding a new screen that needs new components, the new components appear inline in the mockup.

## Cap

One mockup file holds at most 3–5 screens. Past that, split into multiple files (e.g., `_prototype-list.tsx`, `_prototype-detail.tsx`) or run multiple sessions. A single stacked file becomes unreadable past that point, defeating the "scroll to review" workflow.

## Workflow

### 1. Confirm scope

Ask the user which screens to mock. Suggest 2–4 high-priority screens for the current discussion, based on the project type and current state (greenfield, new feature, redesign).

If the user references existing apps ("like Linear", "Notion-style", "Figma-like"), use Context7 or web search to research those apps' UI patterns before building. This grounds the mockup in concrete references rather than guessing.

Get agreement on the screen list before building.

### 2. Detect stack and file location

Read `package.json` and config files to determine framework. Read source layout to find where app code lives. Pick the mockup file path:

- Next.js (App Router) → `app/_prototype/page.tsx`
- Next.js (Pages Router) → `pages/_prototype.tsx`
- Nuxt → `pages/_prototype.vue` or `app/pages/_prototype.vue`
- Vite + React → `src/_prototype.tsx`
- Vite + Vue → `src/_prototype.vue`
- Vite + Svelte → `src/_prototype.svelte`
- Solid Start → `src/routes/_prototype.tsx`
- SvelteKit → `src/routes/_prototype/+page.svelte`
- Remix → `app/routes/_prototype.tsx`
- Qwik City → `src/routes/_prototype/index.tsx`
- Astro → `src/pages/_prototype.astro`
- Honox (Hono + JSX) → `app/routes/prototype.tsx`
- Plain HTML / no framework → `prototype.html` (project root)
- Other / unclear → ask the user

The `_prototype` prefix signals "not part of the real app" — Next.js, Nuxt, SvelteKit, Remix, Qwik City, and Honox treat it as a private route; other frameworks ignore the prefix. Confirm the location with the user if it is non-obvious.

### 3. Build the mockup

One file. Project stack. Hardcoded values. No real functionality. All screens stacked vertically with comments or section breaks as dividers. The dev server's hot reload shows every edit.

**Section format** — each section must have an `id` attribute for screenshot navigation:

```tsx
<div id="section-default" class="...">
  <h3>1. Default state</h3>
  <p>Subtitle explaining the state.</p>
  {/* canvas content */}
</div>

<div id="section-context-menu" class="...">
  <h3>2. Right-click context menu</h3>
  {/* ... */}
</div>
```

Naming convention: `section-{kebab-case}` (e.g., `section-default`, `section-inline-edit`, `section-delete-confirm`). The id is used by `scrollIntoView` to navigate to specific sections for screenshots.

**Prototype file structure** — the outer format follows a standard pattern:

```tsx
// ── Data ──
// Card definitions, connections, auto-layout function

// ── Components ──
// Reusable UI components (card, row, frame, section wrapper, etc.)

// ── Interaction States ──
// Each state is a component that renders a specific UI state

// ── Page ──
<div class="max-w-310 mx-auto px-6 py-8 space-y-12">
  {/* Page header */}
  <div>
    <h2 class="text-lg font-bold text-gray-900 mb-1">Title</h2>
    <p class="text-[13px] text-gray-500">
      Description of what this prototype shows.
    </p>
  </div>

  {/* Sections — each with id for screenshot navigation */}
  <Section title="1. Section title" subtitle="What this section demonstrates.">
    <div id="section-default"></div>
  </Section>

  <Section title="2. Section title" subtitle="...">
    <div id="section-context-menu"></div>
  </Section>
</div>
```

Container: `max-w-310 mx-auto px-6 py-8 space-y-12` (fixed width, centered, padded, vertical spacing).

Component usage — depends on the project state:

- Existing components available (Button, Card, layout primitives) → use them so the mockup matches the real build.
- Greenfield project (no components yet) → the mockup is the prototype. The build phase extracts components from it. Do not invent a component abstraction that does not yet exist.
- Existing app, new screen that needs new components → include the new components inline in the mockup. The build phase promotes them to real components.

Other rules:

- No event handlers, no animations, no real state, no API calls. The component tree may still render lists, map over data, etc. — that is static rendering, not interactivity.
- Buttons, forms, links are visual only — they render but do nothing when interacted with.
- Realistic content (not "lorem ipsum" repeated).
- Empty / error / loading states only if the user asked.
- Hardcoded text, colors, sizes, layout — no props, no theming, no abstraction in the mockup itself.
- The mockup must be deletable by removing one file.

### 4. Show in dev environment

Start the dev server. The user reviews the rendered browser view directly. Hot reload shows every edit immediately. For plain HTML, open the file directly or serve it statically.

If the agent itself needs to see the mockup (cmux browser available), follow the **agent-side screenshot workflow** below.

Ask the user:

- "Is this the visual direction?"
- "What features are missing or wrong?"
- "Which parts need adjustment?"

#### Agent-side verification (cmux browser)

cmux browser is the agent's window into the rendered mockup. The user sees the dev server in their own browser; cmux is the agent's parallel view for self-review.

**Open the mockup:**

```bash
# 1. open the dev server URL in a cmux surface (capture surface_ref from response)
cmux --json browser open http://localhost:5173/_prototype
# response includes "surface_ref": "surface:N" — use that N below

# 2. wait for the page to render
cmux browser surface:<N> wait --load-state complete --timeout-ms 10000
```

Replace `<N>` with the actual surface number from the `open` response. The surface ref is a fresh handle per session — never hardcode a number.

**Screenshot (what does it look like):**

To screenshot a specific section, scroll to it first using the section id:

```bash
# 1. scroll to the target section
cmux browser surface:<N> eval "document.getElementById('section-default').scrollIntoView({block: 'start'})"

# 2. wait for scroll to complete
cmux browser surface:<N> wait --load-state complete --timeout-ms 3000

# 3. take the screenshot
cmux browser surface:<N> screenshot --out ./screenshots/prototype-section-default.png
# then read the file with the read tool to see the image
```

Use `cmux browser screenshot --out <project-relative-path>` to save into the project. Without `--out`, the command writes to `$TMPDIR/cmux-browser-screenshots/` — a global temp directory outside the project's reach. There is no `--full-page` option.

Save path conventions:

- Folder: `./screenshots/` at the project root (create with `mkdir -p` if missing).
- Filename: descriptive, versioned — e.g. `mockup-v1.png`, `mockup-after-feedback.png`.

If a screenshot is cut off (cmux viewport limitation, not the mockup's fault), narrow the mockup or capture multiple views rather than enlarging the browser window.

**Inspect (why does it look that way):**

When the screenshot reveals a layout problem, inspect DOM and computed styles to find the cause.

```bash
# DOM structure with element refs
cmux browser surface:<N> snapshot --interactive

# Position and size of a specific element
cmux browser surface:<N> get box ".goal-card"

# Computed style (e.g., is the gap actually applied?)
cmux browser surface:<N> get styles ".goal-row" --property "gap"

# Ad-hoc JS — count, measure, anything
cmux browser surface:<N> eval "document.querySelectorAll('[data-goal-id]').length"

# Rendered text or HTML of a region
cmux browser surface:<N> get text ".header"
```

Use these to diagnose before editing the mockup. When the inspection matches the design intent, the screenshot is the deliverable; when it doesn't, the inspection is the lead.

### 5. Iterate or lock in

If changes needed → edit the mockup → dev server hot reloads → user reviews → repeat. The loop is fast because the dev server picks up every edit.

If aligned → leave the mockup file in the repo as a snapshot. The build phase can reference it as the visual target.

### 6. Clean up after lock-in

The mockup file stays in the repo. Everything else set up for the prototype session is throwaway — close it down so the next phase (build) starts clean.

- **Dev server** — stop it. If you started it (`pnpm dev` or equivalent), kill the process. Don't leave it running in the background.
- **cmux browser surface** — close it. If you opened one for the screenshot workflow, close it.
- **Screenshots in `./screenshots/`** — delete them. They were working data for your self-review, not deliverables. The mockup file is the artifact; the PNGs are noise once the direction is locked.

The only thing that survives is the mockup file at its agreed path (e.g. `app/routes/_prototype.tsx`).

## Examples

User scenarios where this skill fires:

Greenfield project (no components yet):

- "I want to build a goal management app" → mockup: gantt view, list view, detail view. The build phase extracts components from this.
- "Build a SaaS dashboard" → mockup: sidebar, main content area, charts.

Adding a new screen or feature to an existing app:

- "Add a settings page" → mockup: settings with sections (account, notifications, billing). Uses existing components if available.
- "Add a Kanban board" → mockup: kanban with columns and cards. New components inline if needed.
- "Add a search results page" → mockup: search input, filters, result cards.
- "Add a profile page" → mockup: avatar, info, activity feed.
- "Build a calendar view" → mockup: month/week view, events.
- "Add notifications" → mockup: notification list, badges.
- "Build a chat interface" → mockup: message list, input, sidebar.
- "Build a pricing page" → mockup: tiers, feature comparison, CTA.

Redesign of an existing screen:

- "Redesign the home page" → mockup the new home page, compare against the existing one.

Reference app mentioned:

- "I want it to feel like Linear" → research Linear's UI patterns first via Context7 or web search, then mockup.
- "Like Notion" → research Notion's UI patterns, then mockup.

General visual alignment:

- "What should this look like?" → mockup 2-3 candidate directions for the user to compare.
- "I want it more minimal" or "more colorful" → adjust the existing mockup or build a new variant.

## Hand off

When aligned:

- Mockup file stays in the repo as an alignment snapshot.
- The design step (if used) references the mockup path as the visual constraint (e.g., "visually matches `app/_prototype/page.tsx`"). The mockup is the input to that step, not a deliverable of it.
- The build phase uses the mockup as the visual target. In a greenfield project, the build phase also extracts components from the mockup.
- If the user later wants to change the visual, re-trigger this skill to refresh the snapshot.

## Drift warning

The mockup is a snapshot. The real implementation will evolve. If the visual drifts from the mockup during the build, the user decides:

- Re-trigger this skill to refresh the mockup to match.
- Or let the mockup stay as the original snapshot and update the implementation freely.

## cmux-browser skill

This skill uses cmux browser for agent-side verification. When you need to perform browser automation (navigation, interaction, DOM inspection), load the `cmux-browser` skill for the full command reference.

Useful commands for prototyping:

| Command                                   | Purpose                                               |
| ----------------------------------------- | ----------------------------------------------------- |
| `scroll-into-view <selector>`             | Navigate to a specific section by id                  |
| `eval <js>`                               | Execute JavaScript (DOM manipulation, scroll control) |
| `get box <selector>`                      | Get element position and size (layout verification)   |
| `get styles <selector> --property <prop>` | Get computed CSS (style verification)                 |
| `highlight <selector>`                    | Highlight an element (visual debugging)               |
| `snapshot --interactive`                  | DOM snapshot with element refs                        |
| `wait --selector <css>`                   | Wait for dynamic content to appear                    |

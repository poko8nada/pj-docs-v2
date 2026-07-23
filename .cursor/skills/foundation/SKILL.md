---
name: foundation
description: >-
  Soft skill: lock look by co-editing a disposable Vite HTML workshop in cmux. User click-comments are a JSON work queue; the agent applies them into HTML/CSS.
  Use from /work for Discover Look (and Build when look must be re-locked). Soft — not a hard gate.
  Commands: scripts/dev.mjs, build.mjs (singlefile HTML → findings/foundation/<slug>.html; images merge into assets/), reset.mjs.
  Returns Topic / Path / Why / Summary / Axes touched to the caller.
---

# foundation

Lock look **by looking at it**. Co-edit HTML/CSS in the Vite workshop under `.cursor/skills/foundation/workspace/`. User click-comments (`comments.json`) are a work queue: apply into the look, then remove those queue entries.

Soft skill — nothing hard-denies if skipped. Durable results live only under `findings/foundation/` (via **build**). The workshop may keep in-progress HTML and comments until **reset**. Do **not** create or edit GitHub issues from here.

## How the caller slices this skill

Each **Step** below is one verifiable unit. Agree and finish a Step before the next. Do not merge later Steps into one silent pass unless the user explicitly allows a short path.

Steps 2–3 may repeat in one sitting until the eye is happy; mid-run **build** (Step 4) is allowed without reset.

## Commands (project root)

### `node .cursor/skills/foundation/scripts/dev.mjs`

- Start Vite + open cmux (comments chrome on)
- Optional: `FOUNDATION_PORT=5174`
- `dev` / `build` call `ensureDeps` first. If `findings/foundation/` has no outcome `.html` yet, that wipe-reinstalls `node_modules` + `pnpm-lock.yaml` then installs — agent need not branch on first run.

### `node .cursor/skills/foundation/scripts/build.mjs`

- Chrome-free Vite **singlefile** → `findings/foundation/<slug>.html`
- Image files merge into shared `findings/foundation/assets/`
  (existing kept; same name overwritten)
- Does **not** reset the workshop
- Optional: `FOUNDATION_SLUG=…`

### `node .cursor/skills/foundation/scripts/reset.mjs`

- Restore workshop `index.html` from `defaults/`
- Clear `comments.json` and local `dist`
- Does **not** delete findings

Mid-run: **build** to snapshot progress into findings (caller may note Path on the issue). Keep working without reset. Start fresh: **reset**, then **dev**.

## What you own

- Workshop under `.cursor/skills/foundation/workspace/` (and `defaults/`, `scripts/`)
- Look markup in `workspace/index.html` (`body` and landmarks — no chrome in HTML)
- Reading `comments.json`, applying notes, clearing those queue entries
- `cmux reload` when the browser must catch up after edits
- Running **build** so findings hold the chrome-free static result
- Handoff fields for the caller

## What you do not own

- GitHub issue bodies or comments
- Whether this session should run — the caller decides
- Shipping the look into the production app tree — the caller uses `findings/`
- Edits outside the foundation skill tree and `findings/foundation/`

## When called

**Scope clear** (e.g. “lock this look”, comps attached): one short confirm if useful, then Steps.

**Unclear what to put on the look:** agree materials in chat (blank vs screenshots/comps), then Steps.

## Roles

- **User** — may edit look HTML/CSS freely; **primary** for comments via click → drawer (queue)
- **Agent** — may edit look HTML/CSS freely; reads the queue; not a durable design doc

After applying a note into the look, remove **that entry only** (by `aid`).

## Steps

### Step 1 — Start workshop

Run **dev**. Reuse cmux if already open on this URL.

**Done when:** Workshop is open and visible. Stop if slicing.

### Step 2 — Co-edit look

Change the look: tokens / surfaces in `look.css` first, structure in `index.html`. Tailwind utilities OK when they use those tokens. Assign `data-aid` on meaningful units. Optional: drop reference images onto the look.

**Done when:** Current look is ready for eye review (or for comment). Stop if slicing.

### Step 3 — Apply comment queue

User: click → drawer → text → `comments.json`.

Agent: read queue → edit HTML/CSS → delete only handled entries → reload cmux if needed.

Repeat Steps 2–3 until eye confirmation (or jump to Step 4 for a mid-run findings snapshot without reset).

**Done when:** Applied notes for this sitting are cleared (or user kept unapplied on purpose). Stop if slicing.

### Step 4 — Build findings

Run **build**. Writes singlefile HTML to `findings/foundation/<slug>.html`; merges images into `findings/foundation/assets/`.

**Done when:** Findings path exists for this slug. Stop if slicing (more co-edit allowed without reset).

### Step 5 — Handoff (and optional reset)

Return the handoff block. **reset** only when starting clean, or after a final build if the workshop should not keep the look.

**Done when:** Close gate below is satisfied.

## Close gate

All of:

1. User confirmed the look by eye (or accepted a mid-run snapshot)
2. **build** has written `findings/foundation/<slug>.html`
3. Handoff to the caller is complete
4. Applied comments are not left in `comments.json` (empty, or only unapplied notes the user kept)

Do not invent a finished look from an empty workshop.

## Handoff (return to caller)

```markdown
- Topic: …
- Path: findings/foundation/<slug>.html
- Why:
  - …
- Summary: … # optional; at most 3 lines
- Axes touched: … # optional; e.g. Look
```

## Conventions

### Look vs chrome

- Product look is the HTML under `body` (structure / utilities). No chrome markup in HTML.
- **Tokens live in `look.css`** (`@theme` / CSS variables): color, surface, type scale decisions. HTML references token-backed utilities (e.g. `bg-paper`, `text-ink`) or named classes defined in `look.css`.
- Do **not** lock look by scattering raw hex / rgb / `bg-[#…]` in markup. If a new color is needed, add it to `look.css` first, then use it from HTML.
- **Images** (photos, bitmaps): put under `workspace/public/assets/` so Vite copies them on build; `build.mjs` merges them into shared `findings/foundation/assets/`. Reference as `./assets/…` from the look HTML.
- **SVG icons**: inline in HTML when needed — no SVG loader required.
- FAB / drawer / hover come from `annotate.js` + `chrome.css` in **dev only**, appended to `body`. Annotate ignores its own chrome. **build** uses `vite-plugin-singlefile` so CSS/JS are inlined (no drawer); open the `.html` via `file://` if you want.

### `data-aid`

- Stable key from element → comment row. Meaningful units only.
- Prefer hosts that can take children; wrap void tags (`img`, …) instead of aiding them.

### Comments queue

- `comments.json` is fs truth for the queue (gitignored). Session / mid-run state — not findings.
- Browser POST `/comments` (dev server only).
- Click opens a **draft**; a comment is committed only when it has non-empty text. Closing (× / backdrop) discards empty drafts — no marker, no queue entry.
- Open drawer shows a dim **backdrop**; click backdrop to close.

## File layout

```
foundation/
├── SKILL.md
├── defaults/
│   └── index.html          # reset の元
├── scripts/
│   ├── dev.mjs
│   ├── build.mjs
│   ├── reset.mjs
│   └── _paths.mjs
└── workspace/              # Vite 作業場（結果の正ではない）
    ├── package.json
    ├── vite.config.js
    ├── vite-plugin-comments.mjs
    ├── index.html
    ├── src/main.js
    ├── src/look.css
    ├── src/chrome.css
    ├── src/annotate.js
    └── .gitignore
```

## Anti-patterns

- Locking color via raw hex / `bg-[#…]` in HTML instead of tokens in `look.css`
- Leaving the only copy of an agreed look in the workshop (skipping **build**)
- Treating `comments.json` as durable design docs
- Clearing the whole comment queue while unapplied notes remain (unless the user dropped them)
- Shipping a vibe-memo instead of the Vite **build** output under findings
- Editing GitHub issues from this skill
- Overwriting prior `findings/foundation/<slug>.html` without intent (use a new slug)
- Running root `pnpm dev` for this workshop — use **dev.mjs**
- Running later Steps without prior Step agreement when the caller expects sliced Steps

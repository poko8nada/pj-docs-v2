---
name: foundation
description: >-
  Soft skill: lock look on a disposable HTML board in cmux. Agent and user both
  edit HTML/CSS; user click-comments go to JSON as a work queue; agent applies
  them then clears the queue. Returns agreed HTML/CSS (or path) to the caller.
---

# foundation

Lock look **by looking at it** on a disposable Vite HTML board in cmux. Agent and user both edit the board. User comments (click → JSON) are a work queue: the agent applies them into HTML/CSS, then clears the queue. Durable output: the **agreed HTML/CSS** (board content, or a path the caller can take into the product).

Soft skill. **Self-contained** — return the agreed board to the caller; the caller persists and ships.

## What you own

- The board workspace (`.cursor/skills/foundation/board/`) — Vite project, separate from the repo root
- `#board` content in `index.html` (and board-local styles the look needs)
- Reading `comments.json`, applying notes into the board, then clearing the queue
- `cmux reload` after board or comments changes that the browser must show
- Returning the agreed HTML/CSS (or path) to the caller

## What you do not own

- Issue create/update — caller
- Production app tree / `rules` — caller ships the agreed look
- Invoking phase skills, `issue`, `rules`, or other soft skills

## When called

**From a phase / caller with scope already clear** (e.g. “lock this look”, comps attached, board topic settled): skip debate. One short confirm if useful, then Flow.

**Standalone / what to put on the board unclear:** agree materials in chat (blank start vs screenshots/comps vs reuse open surface), then Flow. No phase-style Context / Understanding / Proposal ritual.

## Roles

| Who       | HTML/CSS (`#board`) | Comments (`comments.json`)                                      |
| --------- | ------------------- | --------------------------------------------------------------- |
| **User**  | May edit freely     | **Primary:** click elements → write notes in the drawer (queue) |
| **Agent** | May edit freely     | Reads the queue; does not treat comments as durable docs        |

Comments are a **work queue**, not a design document. After the agent applies a note into the board, remove **that entry only** (by `aid`); leave unapplied notes.

## Flow

1. **Start** — `node .cursor/skills/foundation/scripts/start.mjs` (project root). Reuse an existing cmux surface if it already shows the board.
2. **Co-edit** — agent and user both change `#board` (hero, type, layout, …). Tailwind on the board is OK. Assign `data-aid` on meaningful units.
   - **Optional:** screenshots or reference images — drop them onto `#board` and/or recreate the look in HTML/CSS. Not required; blank or type-only boards are fine.
3. **Comment (user)** — user clicks a board element → drawer row → text. Saves to `comments.json` (auto-save, or ⌘/Ctrl+Enter to save-and-close).
4. **Apply (agent)** — read `comments.json` → change HTML/CSS for the notes you handle → delete **only those** entries from the JSON (keep the rest) → `cmux reload` if the browser is stale.
5. **Repeat** — co-edit and comment until the user confirms by eye.
6. **Done** — hand off (below). This skill writes no issues.

## Close gate

Done when:

1. The user has confirmed the look by eye, and
2. Handoff to the caller is complete, and
3. `comments.json` is empty (every note applied or explicitly dropped with the user).

Do not invent a finished look from an empty board. Do not leave applied comments sitting in JSON.

## Handoff

Return to the caller, in chat, **both**:

1. Path: `.cursor/skills/foundation/board/index.html` (and any board assets you added), and
2. What to take: the `#board` markup (and board-local styles that define the look).

Caller folds that into the product. The board is a workshop — clear or delete when the product surface carries the look. `comments.json` stays session-only (gitignored).

## Startup

```
node .cursor/skills/foundation/scripts/start.mjs
```

Optional: `FOUNDATION_PORT=5174` if `5173` is taken.

The wrapper installs board deps when needed, runs `foundation:dev`, opens cmux, stays foreground until Ctrl-C. Use this wrapper — not the project root's `pnpm dev`.

## Conventions

### Chrome

- Chrome (FAB, drawer, hover guide) is created by `annotate.js` on `document.body` — not authored in `index.html`.
- Chrome CSS is plain in `src/style.css`, independent of Tailwind.

### `data-aid`

- Stable key from board element → comment row. Agent assigns when writing `#board`; user may add more.
- Meaningful units only. Prefer hosts that can take children; wrap void tags (`img`, …) instead of aiding them.
- Prefer explicit aids over generated selector fallback.

### Comments queue

- `comments.json` is fs truth for the queue (gitignored).
- Browser POST `/comments` (debounced) → Vite plugin writes the file. Watcher ignores it.
- Agent applies selected notes → removes **those** entries only. Reload cmux when the browser must catch up.

### Dev-only

- Alignment tool. `foundation:dev` only. No `vite build` — comments endpoint is dev-only.

## File layout

```
foundation/
├── SKILL.md
├── scripts/start.mjs
└── board/
    ├── package.json
    ├── vite.config.js
    ├── vite-plugin-comments.mjs
    ├── index.html            # #board content (co-edited)
    ├── src/main.js
    ├── src/annotate.js       # chrome + click → comments
    ├── src/style.css
    └── .gitignore            # node_modules, dist, .vite, comments.json, *.log
```

## Anti-patterns

- Treating `comments.json` as durable design docs — it is a queue; remove entries after apply
- Clearing the whole queue while unapplied notes remain (unless the user dropped them)
- Shipping a vibe-memo instead of the agreed HTML/CSS
- Imposing taste via a starter skin — canvas, not a template
- Skipping `data-aid` then relying on generated selectors across rewrites
- Invoking phase skills, `issue`, `rules`, or other soft skills from here
- Running `vite build` or root `pnpm dev` for this board

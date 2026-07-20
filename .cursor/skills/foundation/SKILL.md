---
name: foundation
description: >-
  Soft skill: lock visual / brand foundation on a disposable HTML board viewed in cmux,
  before Spec. Click-to-comment on any element; comments persist as JSON via a Vite dev
  endpoint the browser POSTs to. Callable from discussion or any phase. Returns
  `# Visual Lock` to the caller; no issue.
---

# foundation

Lock the product's visual / brand foundation **before** Spec, by looking at it. The board is a disposable HTML mood surface served by Vite and opened in cmux; the durable output is a short `# Visual Lock` block handed back to the caller. No issue is created here.

Soft skill: same layer as `feasibility`, `grain`, `readme`. Callable from `discussion` or any phase, standalone or before Spec. **Self-contained** — do not invoke phase skills or `issue`. Return outputs to the caller.

## Position

| Layer | Decides | Medium |
| ----- | ------ | ------ |
| **foundation** (this) | World / vibe / hero register / forbidden AI-look cluster | Image + HTML board, seen in cmux |
| Spec | Goal / Scope / Architecture | Text issue |
| grain | Axes → tokens (translates this layer) | Text |
| Design | Screen composition / thinking surface | Production-stack code |

`foundation` may run **before** Spec. When a Spec exists later, the caller folds `# Visual Lock` into the Spec's opening section by hand — this skill does not move it.

## What you own

- The board workspace (`.cursor/skills/foundation/board/`) — a Vite project, separate from the repo root
- `index.html` (the touched content / product) and `comments.json` (data)
- `comments.json` CRUD on fs (agent reads/writes the file directly; the browser POSTs edits via the Vite dev endpoint)
- Triggering `cmux reload` after the agent writes `comments.json`
- The `# Visual Lock` block returned to the caller

## What you do not own

- Spec / Design issue creation or lifecycle — `issue` via the caller
- grain axes or token derivation — `grain`
- Production code / `rules` — caller ships
- Invoking `issue`, `rules`, or phase skills from here

## File layout

```
foundation/
├── SKILL.md                  # ルートはこれだけ
├── scripts/
│   └── start.mjs             # 起動ラッパ（スキルルート・Cursor標準位置・プロジェクトルートから実行）
└── board/                    # Viteプロジェクト（作業場・ルートとは別物）
    ├── package.json          # vite / tailwindcss / @tailwindcss/vite
    ├── vite.config.js        # tailwind() + commentsPlugin() / watch で comments.json 除外
    ├── vite-plugin-comments.mjs  # GET/POST /comments → comments.json 読み書き（Viteプラグイン・dev専用）
    ├── index.html            # 殺壳兼プロダクト: <div id="board"> 内に header/main/footer 見本。bodyは無装飾
    ├── src/
    │   ├── main.js           # ローダ: GET /comments → annotate 起動（中身は index.html 直書き・注入なし）
    │   ├── annotate.js       # メタ層: FAB+ドロワー+ホバー補助線生成・クリック→コメント・Cmd+Enter保存
    │   └── style.css         # @import "tailwindcss" + #meta/.vl-* クロームCSS
    ├── comments.json         # fs正
    └── .gitignore            # node_modules / dist / .vite
```

2つの関心事は別ファイル：中身(`index.html`)・データ(`comments.json`)。クローム(`src/annotate.js`+`src/style.css`)はJS生成でラッパーを汚さない。中身編集でクロームを壊すことはない。

### Wrapper vs product

- `index.html` はラッパー兼プロダクト。`body` には色・クラスをつけない（製品の見え方に影響するため）。製品の色は `#board` が持つ。
- `#board` は `<div>`（プロダクトルート）。その中に `<header>/<main>/<footer>` を直書きする。見本として初期配置済み。
- クローム（`#meta` パネル・FAB・ホバー補助線）は `annotate.js` が `document.body` に生成する。`index.html` には置かない。

### Chrome behavior (FAB + drawer + hover guide)

- `#meta` は常時開きっぱなしのasideではなく、**右ドロワー**。既定は閉じて右に隠れている。
- 右下の**浮遊ボタン（FAB・チャットボット風）**で開閉トグル。FABにコメント数バッジ。
- **ボード要素をホバー**すると補助線＋aid名が表示される（ブラウザdev tool風・pointer-events:none で操作を邪魔しない）。
- **ボード要素をクリック**すると該当要素のコメント行を用意し、パネルを開いて入力にフォーカス。
- コメント入力中 **⌘/Ctrl + Enter** で即保存してドロワーを閉じる。閉じるボタン/FABでも閉じる。
- クロームは製品と**影・浮遊**で視覚的に区別する（製品の背景色には依存しない）。

## Conventions (must follow)

### `data-aid` — skill-specific attribute

- `data-aid="<id>"` is **this skill's** stable key for linking a board element to its comment.
- The agent assigns `data-aid` to each element when writing `index.html` (the `#board` content). The user may add more.
- If an element lacks `data-aid`, `annotate.js` falls back to a generated CSS selector (less stable across rewrites).
- Document this for both sides: agent writes it, user sees it as the comment row label and as the hover-guide label.

### Persistence (comments actually save)

- `comments.json` is the fs source of truth.
- Browser edits → `annotate.js` POSTs `/comments` (debounced ~400ms) → `vite-plugin-comments.mjs` writes `comments.json`. Reload-safe; edits survive.
- `comments.json` is excluded from Vite's file watcher, so POST writes do not trigger a reload storm.
- Agent reads `comments.json` directly from fs (no `cmux eval` read needed). Agent writes `comments.json` directly, then runs `cmux browser surface:N reload` to push to the browser.

### Tailwind (Vite-idiomatic, not a CDN bolt-on)

- Tailwind v4 via the first-party `@tailwindcss/vite` plugin; `src/style.css` has `@import "tailwindcss"`.
- Chrome (`#meta` / `.vl-*`) is plain CSS in `src/style.css` and does **not** depend on Tailwind — removing the `@import` line never breaks the comment panel.

### Dev-only — do not build

- The board is a disposable alignment tool, never shipped. There is **no build script**.
- `vite-plugin-comments.mjs` uses `configureServer`, which only runs in `vite dev`. A `vite build` would produce a static bundle with no `/comments` endpoint — edits could not save. So `vite build` is out of scope.

## Startup (one command, from project root)

```
node .cursor/skills/foundation/scripts/start.mjs
```

The wrapper:
1. Installs `board/` deps via `pnpm --ignore-workspace --dir <board> install` if `node_modules` is missing (does **not** touch the project root's `package.json`).
2. Starts Vite (`pnpm --ignore-workspace --dir <board> run foundation:dev`) on `http://127.0.0.1:5173`.
3. Polls the port, then runs `cmux browser open <url>`.
4. Stays foreground; Ctrl-C stops Vite and exits.

Do **not** run bare `pnpm dev` — it collides with the project root's own scripts. Always use the wrapper.

## Flow

1. **Start** — run the wrapper above. Reuse an existing cmux surface if one already shows the board.
2. **Collect** — drop reference images / hero comps / type tryouts into `index.html` (the `#board` content). Author freely with Tailwind utilities; assign `data-aid` per element.
3. **Annotate** — user clicks any board element → a comment row appears in `#meta`; edit the textarea (auto-saves, or ⌘/Ctrl+Enter to save-and-close). The agent may also click via cmux CLI (those edits auto-save too).
4. **Sync** — agent reads `comments.json` from fs; if the agent writes it, run `cmux reload` to reflect in the browser.
5. **Lock** — when the user says "this vibe" by eye, return `# Visual Lock` (short): reference image paths, forbidden cluster, hero register, 1-line vibe. The board workspace is disposable; delete when the product speaks for itself.

## `# Visual Lock` shape

```markdown
# Visual Lock

- Vibe: …(one line)
- Hero register: …
- References: ./path1, ./path2
- Forbidden: …(AI-look cluster to avoid)
```

## Anti-patterns

- Persisting to an issue from here — hand `# Visual Lock` to the caller.
- Running bare `pnpm dev` — collides with the project root; use the wrapper.
- Touching the project root's `package.json` — `board/` is a separate project.
- Running `vite build` — the board is dev-only; the comments endpoint is dev-only.
- Imposing taste via a starter skin — the board is a canvas, not a template.
- Skipping `data-aid` then relying on fragile generated selectors across rewrites.
- Treating the board as maintained product — it is disposable, like `prototype/`.

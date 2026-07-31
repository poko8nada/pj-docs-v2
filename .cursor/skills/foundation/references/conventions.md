# foundation — conventions

## Look vs chrome

- Look = HTML under `body`. No chrome markup in HTML.
- Tokens in `look.css` only — no raw hex / `bg-[#…]` in markup.
- Images under `workspace/public/assets/`; build merges to `findings/foundation/assets/`.
- SVG icons: inline in HTML.
- FAB/drawer = dev chrome only (`annotate.js` + `chrome.css`).

## data-aid

Stable key from element → comment row. Prefer hosts that can take children; wrap void tags.

## Comments queue

- `comments.json` is queue truth (gitignored) — not findings.
- Apply a note → delete **that** entry by `aid` only.
- Empty drafts discarded; no marker.

## Layout

```
foundation/
├── SKILL.md
├── defaults/index.html
├── scripts/{dev,build,reset,_paths}.mjs
└── workspace/   # Vite workbench — not source of truth
```

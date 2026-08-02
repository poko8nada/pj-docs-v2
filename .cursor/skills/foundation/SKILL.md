---
name: foundation
description: >-
  Locks visual direction through a disposable Vite/HTML workshop in cmux so a reviewed look can be persisted as a findings artifact. Use for Discover Look or an intentional Build visual re-lock. Do not use for ordinary product implementation or an empty workshop; use the bundled scripts and write the durable result to findings/foundation/.
---

# foundation

Co-edit workshop look; durable result only via **build**. No GitHub issues.

Conventions → `references/conventions.md`. Steps 2–3 may loop; mid-run build OK without reset.

## Commands (repo root)

- `node .cursor/skills/foundation/scripts/dev.mjs` — Vite + cmux
- `node .cursor/skills/foundation/scripts/build.mjs` — singlefile → `findings/foundation/<slug>.html` (+ assets merge)
- `node .cursor/skills/foundation/scripts/reset.mjs` — restore workshop; does not delete findings

## Steps

1. **dev** — workshop open. Stop if slicing.
2. **Co-edit** — tokens in `look.css`, structure in `index.html`; `data-aid` on units.
3. **Apply queue** — read `comments.json` → edit → delete handled `aid` → reload if needed. Repeat 2–3 until eye OK (or build mid-run).
4. **build** — findings path exists for slug.
5. **Handoff** (+ optional reset). Close when: eye confirmed (or mid-run accepted); build written; handoff done; applied comments cleared (or user kept unapplied).

## Handoff

Topic / Path (`.html`) / Why / Summary / Axes touched.

## Limits

- Use `dev.mjs`, not root `pnpm dev`.
- Do not invent a finished look from an empty workshop.
- Do not treat `comments.json` as durable design docs.
- Do not overwrite slug without intent; do not ship workshop as product tree.
- Do not edit issues.

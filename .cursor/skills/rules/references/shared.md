# Shared

Cross-cutting writing manners — apply with logic, components, or either. Default if unsure which reference fits.

## Premise

- **Colocation** — think in **feature folders**, not scattered flat files. Keep together what changes together: UI/code, **logic**, small helpers, and **tests**.
- Distance makes refactors and grep worse. Grep-ability and clear ownership beat clever indirection.
- When creating or editing a file, if the layout feels messy or a new concern has no home, **propose a folder (or move) to the user before dumping another file in a catch-all place**. Do not silently invent deep trees — ask.

## Placement

- Default: one concern → one folder; put code, logic modules, small helpers, and their tests side by side in that folder.
- Same directory → `./`. Cross-directory → `@/` aliases. Never use relative `../` across feature boundaries.
- Named exports only — no default exports (they hide symbols from rename/grep tooling).
- Promote to a real shared layer only when two or more features need the same module; otherwise keep it local.

## Writing

- Add Japanese comments to functions and important processes. Keep them minimal.
- File and export names in English; names should state the role (`parseInvoice`, `InvoiceRow`), not vague utilities (`helpers`, `utils2`).

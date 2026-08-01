# Conventions

Cross-cutting conventions — apply with logic, components, or either. Default if unsure which reference fits.

## Apply when

Use for cross-cutting changes to placement, naming, exports, comments, or test conventions. Start here when the change does not have a clearer semantic owner.

## Owns

- Feature-folder colocation and dependency direction.
- Stable English names, named exports, Japanese comments, and focused test descriptions.
- General test quality: observable behavior, important failure or edge paths, deterministic fixtures, and minimal mocks.

## Does not own

- UI composition or semantic markup.
- Domain rules, network I/O, persistence, or UI interaction state.

## Handoff

- Read `components` or `markup` for presentation and semantic markup.
- Read `logic`, `ui-state`, `api`, or `data` for their respective semantic concerns.

## Premise

- **Colocation** — think in **feature folders**, not scattered flat files. Keep together what changes together: UI/code, **logic**, small helpers, and **tests**.
- Distance makes refactors and grep worse. Grep-ability and clear ownership beat clever indirection.
- When creating or editing a file, if the layout feels messy or a new concern has no home, **propose a folder (or move) to the user before dumping another file in a catch-all place**. Do not silently invent deep trees — ask.

## Placement

- Default: one concern → one folder; put code, logic modules, small helpers, and their tests side by side in that folder. Never a separate top-level `__tests__` directory.
- Same directory → `./`. Cross-directory → `@/` aliases. Never use relative `../` across feature boundaries.
- Named exports only — no default exports (they hide symbols from rename/grep tooling).
- Promote to a real shared layer only when two or more features need the same module; otherwise keep it local.

## Writing

- Add Japanese comments to functions and important processes. Keep them minimal.
- Test descriptions: include a Japanese translation in the test's comment (same bar as important process comments — the one place tests should be a bit more verbose).
- Tests should describe behavior rather than mirror implementation details. Keep fixtures deterministic and cover important failure or edge paths without adding unnecessary mocks.
- File and export names in English; names should state the role (`parseInvoice`, `InvoiceRow`), not vague utilities (`helpers`, `utils2`).

# Logic

## Apply when

Use when writing pure / domain logic (functions, ADTs, non-UI modules).

## Owns

- Pure transformations, domain invariants, domain errors, and explicit success/failure values.
- Decisions that should remain independent from UI, transport, and persistence drivers.

## Does not own

- Network I/O, database or storage drivers, React, or UI interaction state.
- Request/response transport details or persistence-specific schema mapping.

## Handoff

- Use `api` for network I/O and transport mapping.
- Use `data` for persistence and schema mapping.
- Use `ui-state` or `components` for UI interaction and presentation.

## Premise

- Data flow should be obvious — prefer functions and ADTs over `class`.
- Pure logic first; side effects live at the edges (`api` / `data` store edge / UI handlers).
- Cross-module failure is data (`Result<T, E>`), not control flow via `throw`.

## Placement

- Keep domain modules free of React, fetch, and DB driver types.
- Prefer sitting **next to** the feature UI/code in the same folder (with helpers and tests) — see `conventions` colocation. Shared pure utils only when truly cross-feature.

## Writing

- No `class` — use functions and ADTs.
- Never `throw` across module boundaries — return `Result<T, E>` instead. Expected absence → `T | undefined`, not `Result`.
- Do not store a value that can be computed from inputs already in scope — derive it at use time.

# Logic

Apply when writing pure / domain logic (functions, ADTs, non-UI modules).

## Premise

- Data flow should be obvious — prefer functions and ADTs over `class`.
- Pure logic first; side effects live at the edges (`api` / `data` store edge / UI handlers).
- Cross-module failure is data (`Result<T, E>`), not control flow via `throw`.

## Placement

- Keep domain modules free of React, fetch, and DB driver types.
- Prefer sitting **next to** the feature UI/code in the same folder (with helpers and tests) — see `shared` colocation. Shared pure utils only when truly cross-feature.

## Writing

- No `class` — use functions and ADTs.
- Never `throw` across module boundaries — return `Result<T, E>` instead. Expected absence → `T | undefined`, not `Result`.
- Do not store a value that can be computed from inputs already in scope — derive it at use time.

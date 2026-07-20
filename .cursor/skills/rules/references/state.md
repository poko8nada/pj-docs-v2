# State

Apply when writing client / UI state (`use*`, local store, derived UI state).

## Premise

- UI state is for interaction — not a second copy of server or domain data.
- Derive, don't duplicate — if state B can be computed from state A, never store B separately.
- Prefer explicit events over implicit sync between mirrored pieces of state.

## Placement

- Keep state as close as possible to where it is used; lift only when sharing requires it.
- Do not mix server-cache concerns into local `useState` mirrors — fetch/cache stays at the API boundary (`api`).

## Writing

- Name state for the UI question it answers (`isOpen`, `selectedId`), not for transport DTOs.
- Update through clear handlers; avoid effects that only copy one state field into another.

# Data

## Apply when

Use when shaping data — objects, JSON, and persistence / schema thinking (not the HTTP call itself → `api`).

## Owns

- Domain object shape, schemas, JSON mapping, persistence mapping, and units of consistency.
- The boundary between stored or external data representation and domain meaning.

## Does not own

- HTTP transport, domain decisions, UI composition, or UI interaction state.
- Driver-specific details in pure domain modules.

## Handoff

- Use `api` for HTTP transport and request/response handling.
- Use `logic` for domain rules and pure transformations.
- Use `ui-state` or `components` for UI-facing data and interaction.

## Premise

- Data should read as meaning, not as bags (`data`, `info`, `payload` nesting). Prefer names that state the role.
- Persist by **aggregate / ownership**, not by mirroring every UI screen as a table. Tables and documents follow the domain boundary you already own in code.
- Flat beats deep when the extra nesting adds no meaning. Prefer one clear object over wrappers around wrappers.

## Placement

- Keep domain types and mappers next to the feature that owns them (with code / logic / tests — see `conventions` colocation).
- Row↔domain (or JSON↔domain) mapping stays at the persistence edge; pure domain modules should not depend on driver / ORM / raw JSON wire types.
- When a new entity has no folder yet, propose one to the user before scattering types across the tree.

## Writing

- Objects: explicit fields, stable naming (English), avoid optional soup when a smaller type or `T | undefined` at the boundary is clearer.
- JSON: same naming as the domain where possible; do not invent a second vocabulary for the wire format unless the external API forces it.
- DB / store: define the unit of consistency first (what must update together), then the shape. Expected “not found” → `T | undefined` (or domain absence), not a thrown exception at callers.
- Do not push SQL / query-builder / storage details into UI or pure domain functions — map at the edge, same idea as `api` for HTTP.

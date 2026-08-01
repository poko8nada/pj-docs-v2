# API

## Apply when

Use when writing HTTP / fetch boundaries.

## Owns

- Request and response transport, status handling, network failures, and transport-to-domain mapping.
- The boundary contract that prevents raw transport types from leaking into callers.

## Does not own

- Domain rules, persistence mapping, UI composition, or UI interaction state.

## Handoff

- Use `logic` for domain decisions and `data` for persistence or schema mapping.
- Use `ui-state` and `components` for loading, error, and presentation behavior.

## Premise

- Network I/O is an edge — map success and failure into domain-friendly values here (`Result` / domain error). Cross-module `throw` rules live in `logic`; this file only says where to catch.
- Non-OK status and network failure are expected paths, not surprises.

## Placement

- Keep request/response mapping in a dedicated boundary module next to the feature (or a thin shared client). Do not scatter DTO shaping through UI or domain cores.
- Colocate API helpers with the feature that owns the resource when only one feature uses them.

## Writing

- Use `try-catch` only around the I/O call; convert to `Result` (or domain error) before returning to callers.
- Do not leak raw `Response` / transport types into UI or domain modules.

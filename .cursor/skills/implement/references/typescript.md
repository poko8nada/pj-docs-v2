# TypeScript

Apply when writing or modifying `.ts` / `.tsx` files.

## Architecture

- No `class` — use functions and ADTs. Classes obscure data flow and make logic harder to trace.
- No default exports — named exports only. Default exports break grep-ability and refactoring tools.
- Imports: same directory → `./`, cross-directory → `@/` aliases. Never use relative `../` across feature boundaries.

## Error Handling

- Never `throw` across module boundaries — return `Result<T, E>` instead.
- Use `try-catch` only for external I/O (fetch, DB, file system).
- Do NOT wrap expected absence in `Result` — use `T | undefined`. Promote to domain error only at the boundary layer.

## State

- Derive, don't duplicate — if state B can be computed from state A, never store B separately.
- Isolate side effects from pure logic — pure functions first, side effects at the edges.

## Comments

- Add Japanese comments to functions and important processes. Keep them minimal.

## Accessibility

- Interactive elements must have accessible labels (`aria-label` or visible text).
- Semantic elements always — no `div` for buttons or links.

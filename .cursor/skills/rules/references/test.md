# Test

Apply when writing or modifying `*.test.ts` / `*.test.tsx` files.

## Premise

- Tests protect error paths first — critical areas aim for full coverage of anticipated failures.
- A happy path often returns early from an error path and returns a result at the end — write that story clearly.

## Placement

- **Colocate** tests in the same feature folder as the unit (code / logic / helpers). Never use a separate top-level `__tests__` directory — see `shared`.

## Writing

- Cover all anticipated error paths for the unit you touch.
- Each test description must include a Japanese translation in its comment — the one place where verbose comments are required.

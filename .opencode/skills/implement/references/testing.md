# Testing

Apply when writing or modifying `*.test.ts` / `*.test.tsx` files.

- Never place tests in a separate top-level `__tests__` directory — breaks grep-ability.
- Priority: critical areas get 100% coverage. Error paths are the most important.
- Happy path is one where the program returns early from an error path and returns a result at the end.
- All anticipated error paths should be covered by tests.
- Each test description must include a Japanese translation in its comment — the one place where verbose comments are required.

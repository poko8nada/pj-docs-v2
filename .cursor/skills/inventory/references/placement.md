# inventory — placement

Canonical file-tree rules for inventory drafts.

## Premise

- Feature folders, not scattered flat files. Keep UI, logic, helpers, tests that change together.
- If layout is messy or a concern has no home, propose a folder/move before dumping into a catch-all.

## Placement

- One concern → one folder; code + tests side by side. Never top-level `__tests__`.
- Shared folder only when **two or more** features need the same module.
- File names in English stating role (`parseInvoice.ts`), not `helpers.ts`.

## When to list a test file

Include colocated `*.test.ts` / `*.test.tsx` when listing **New or substantially changed domain / pure logic**.

Omit when the row is only CSS/visual, config-only, trivial getters, or external plugin internals.

No separate “tests-only” section.

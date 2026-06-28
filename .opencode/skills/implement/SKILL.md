---
name: implement
description: "Build the unit described in an agreed plan and produce a confirm message listing the changed files. Use when the plan has been agreed via the question tool and the user has said 'go' / '実行'."
compatibility: opencode
---

# implement

Build the unit described in the agreed plan. The plan is the source of truth — do not reopen settled questions, do not expand scope, do not run per-file checks.

## Build

Build exactly what the plan's `fileChanges` specifies. Not a stub — correct structure, behavior, and edge cases handled.

Keep the development environment operational at all times. The user should be able to verify the result at any point.

#### `.ts` / `.tsx` (TypeScript)

Apply when writing or modifying TypeScript files.

**Architecture**

- No `class` — use functions and ADTs. Classes obscure data flow and make logic harder to trace.
- No default exports — named exports only. Default exports break grep-ability and refactoring tools.
- Imports: same directory → `./`, cross-directory → `@/` aliases. Never use relative `../` across feature boundaries.

**Error Handling**

- Never `throw` across module boundaries — return `Result<T, E>` instead.
- Use `try-catch` only for external I/O (fetch, DB, file system).
- Do NOT wrap expected absence in `Result` — use `T | undefined`. Promote to domain error only at the boundary layer.

**State**

- Derive, don't duplicate — if state B can be computed from state A, never store B separately.
- Isolate side effects from pure logic — pure functions first, side effects at the edges.

**Comments**

- Add Japanese comments to functions and important processes. Keep them minimal.

**Accessibility**

- Interactive elements must have accessible labels (`aria-label` or visible text).
- Semantic elements always — no `div` for buttons or links.

#### `.css` and UI in `.tsx` (Tailwind v4)

- No `tailwind.config.js` — all tokens defined in `@theme inline` in CSS only.
- No `@apply` — defeats the purpose of utility-first and creates hidden coupling.
- No bracket variables in class names unless it's a custom value.
- Mobile-first responsive design using Tailwind breakpoint prefixes (`sm:`, `md:`, `lg:`).

#### `*.test.ts` / `*.test.tsx` (Testing)

- Never place tests in a separate top-level `__tests__` directory — breaks grep-ability.
- Priority: critical areas get 100% coverage. Error paths are the most important.
- Happy path is one where the program returns early from an error path and returns a result at the end.
- All anticipated error paths should be covered by tests.
- Each test description must include a Japanese translation in its comment — the one place where verbose comments are required.

#### `.md` / `.mdc` (Markdown authoring)

- Bold (`**…**`) — at most one per paragraph. Use only when emphasis is truly necessary (e.g., important warnings or terms defined only once). Indiscriminate bold clutters the text and looks unprofessional; avoiding it entirely makes text too plain.
- Tables — small/medium width, total cell characters per row < 80. For multi-row content, use headings or nested bullet points. If a table is in the provided template, follow the template but keep it compact.

## Confirm

List the specific changes: which files, functions, components were created or modified. Note any deviation from the plan (with the user's explicit approval).

Verification commands (`pnpm typecheck` / `lint` / `format` / `test:run`) run as a single batch after all changes are complete — do not run them per-file. The batched verification is the user's gate, not this skill's.

If the work was a vertical slice, the pattern validation question goes to the plan skill (Phase 4), not here.

# mentor — Output templates

Execute before emitting **Digest** or **Hint** to the learner.

## Locale

- This reference is English (agent docs).
- **Chat output to the learner is Japanese** per `AGENTS.md` — section headings stay English (`Done`, `Why`, `Steps`, `Hint: Step N`). Write bullets and explanatory prose in Japanese; technical symbols and identifiers may stay as written.

## Digest

Output once when the slice enters implementation. No code fences in chat (entries go under each file as plain text).

```markdown
**Done:** (one sentence — slice end state)

**Why:**

- (condition closer to Done)
- (prerequisite)
- …

**Steps:** (3–7)

1. (one-line beat — start with a verb)
   - **`package.json`** (`edit`)
     - dependency: `zod` — runtime validation
     - script: `test:run` → `vitest run`

   - **`path/to/file.ts`** (`new`)
     - `type Session = { userId: string; expiresAt: Date }`
     - `function parseSession(raw: unknown): Session | null` — `raw`: … / returns: …

   - **`path/to/file.test.ts`** (`new`)
     - `describe('parseSession')` — cases: null input, invalid shape, valid

2. …
```

### Field rules

- **Done** — slice end state in one sentence. Not the whole product goal.
- **Why** — bullets only. Read top → bottom: closer to **Done** first, then prerequisites. Explains why this slice exists; do not repeat per step.
- **Steps** — implementation order. Each file is one bullet; nest **that file’s entries** under it. Same path may appear in multiple steps.

Write entries by kind — enough to implement without prose algorithms:

| Kind        | Include                                                 |
| ----------- | ------------------------------------------------------- |
| Type        | fields, optional, union members                         |
| Function    | params, return type, throws if any                      |
| Component   | props, children, events                                 |
| Test        | `describe` / `it` angles                                |
| Dependency  | package name, dev/prod; `pnpm add` when one-off         |
| Config      | keys, plugins, paths, env var names                     |
| Route / API | path, method, handler name                              |
| Schema      | table, column, migration direction                      |
| Constant    | name, meaning, example value                            |
| Script      | `package.json` script name and command                  |
| Other       | when not a symbol — what to do in that file (1–2 lines) |

Do **not** add Flow, Check, or per-step Why fields.

Close Digest with: step number → Hint; deeper detail → chat or `/stub`.

## Hint

When the learner names a Digest step (by number) or is stuck on one beat.

For **each entry in that step**, describe **what it does** — input, branches, return, config effect — in short bullets or lines. Teach processing, not file layout (Digest already has that).

**Write:** responsibility, data flow, edge cases, one pitfall if non-obvious.

**Do not write:** function bodies, import lists, or copy-paste-ready code. That is `/stub` or normal implementation, not Hint.

```markdown
### Hint: Step 2

**`parseSession`**

- takes `unknown`; non-object → `null`
- requires `userId` string; otherwise `null`
- returns `{ userId, expiresAt }` when valid

**`Session`**

- return shape for parse; `expiresAt` typed here if used later
```

Do not re-dump the whole Digest unless they ask to reorient.

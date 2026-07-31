---
name: mentor
description: >-
  Human-centered coding overlay: agent advises; human implements.
  User sends /mentor; /mentor off leaves. Agents must not self-invoke.
disable-model-invocation: true
---

# mentor

Layer on the current session. Does not change `phase` or `unlock.*`.

## Steps

1. **Drive (non-code):** same momentum as without mentor — issues, findings, judgment, agenda proposals.
2. **Code:** human writes. Agent does not drive edits. Scope = current agreed slice only.
3. Read learner code from the repo. Run slice **Test** yourself; **Surface** stays human.
4. Before Digest or Hint → execute `references/output-templates.md`.
5. Digest once when slice enters implementation (3–7 concern beats; no file-at-a-time; no tests-only tail).
6. Hint when learner names a step or is stuck.
7. Starting shape → user `/stub` (one turn). Leave mentor → `/mentor off`.

| Command       | Action                 |
| ------------- | ---------------------- |
| `/mentor`     | `mentor: true`         |
| `/mentor off` | leave (not sessionEnd) |

While on and not `/stub`: reviewable code edits denied; Read allowed; `pnpm test` / `test:run` allowed without waiting on `rules`.

## Limits

- Agents must not invoke `/mentor`, `/mentor off`, or `/stub`.
- `/stub` while mentor off is harness no-op.

Hand off: `stub` / `references/output-templates.md`.

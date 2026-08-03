# Commit message

Use the staged candidate as the only source for the message.

The subject is an English imperative sentence without a trailing period and should stay within 72 characters. Use a specific outcome verb such as `Add`, `Fix`, `Update`, `Refactor`, `Remove`, `Clarify`, or `Separate`.

Use exactly these body sections, separated by one blank line:

```text
Why:
<the problem or reason for the change>

What:
<the resulting behavior, contract, responsibility boundary, and intentional exclusions>

Verify:
- <command and result>
- <operational or documentation check>
```

`Why` explains why the change was needed. `What` explains what changed and what deliberately did not change. `Verify` records concrete checks; use `N/A: <reason>` only when no command applies.

Write enough context for someone reading only `git log` to understand the motivation, result, boundary, and verification. Do not write a chat transcript, list every edited file, or describe implementation steps that do not explain the result.

The commit script appends exactly one trailer after the body:

```text
Co-authored-by: Cursor <cursoragent@cursor.com>
```

Do not add that trailer manually. The commit script removes an existing identical Cursor trailer before appending one.

Example:

```text
Add staged commit review flow

Why:
The previous Harness path injected review content only for Task calls and could not cover models that expose functions instead.

What:
Move staged-candidate hashing and reviewer payload generation into the commit Skill while keeping Harness responsible for reviewer evidence. Keep non-reviewable staged files in the commit hash without requiring a reviewer for them.

Verify:
- `node --check .cursor/skills/commit/scripts/review.mjs`
- `pnpm test:run` passed with no test files

Co-authored-by: Cursor <cursoragent@cursor.com>
```

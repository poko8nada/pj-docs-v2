# Commit message

Unit commits and Intent integration commits use different message contracts.

## Unit commit

Each Unit is a review and provisional commit boundary. Its subject is one
mechanical line:

```text
unit-<intent-slug>-<unit-id>: <short Intent summary>
```

Example:

```text
unit-review-evidence-review-evidence-unit-1: connect review evidence
```

The subject must be English, contain no trailing period, and stay within
72 characters. Do not add `Why`, `What`, or `Verify` to a Unit message.
`commit.mjs` appends the Cursor trailer automatically.

## Intent integration commit

Only when the user explicitly requests history integration, use the Intent's
full message:

```text
<English imperative subject without a trailing period>

Why:
<the problem or reason for the Intent>

What:
<the resulting behavior, responsibility boundary, and deliberate exclusions>

Verify:
- <each Unit review result>
- <final tree equality check>
```

`Why` explains why the Intent was needed. `What` explains the resulting
contract and what deliberately did not change. `Verify` records concrete
Unit-level review results and the integration tree check. Use
`N/A: <reason>` only when no command applies.

The commit script appends exactly one trailer after either form:

```text
Co-authored-by: Cursor <cursoragent@cursor.com>
```

Do not add that trailer manually. The script removes an existing identical
Cursor trailer before appending one.

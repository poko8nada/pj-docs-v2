# Commit message

Unit commits and Intent commits use different message contracts.

## Unit commit

Each Unit is a review and provisional commit boundary. Its subject is one mechanical line:

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

Use the Intent's full message for a single-row Intent and for every final Intent integration commit:

```text
<English imperative subject without a trailing period>

Why:
<このIntentが必要だった理由を日本語で書く>

What:
<変更後の挙動、責務境界、意図的に変更しない範囲を日本語で書く>

Verify:
- <各Intent rowまたはUnitのレビュー結果を日本語で書く>
- <最終tree一致確認を日本語で書く>
```

The subject remains an English imperative because it is the stable, concise history identifier shared by Unit and Intent commits. The prose values under `Why`, `What`, and `Verify` must be Japanese. Keep fixed labels, paths, SHAs, branch names, commands, test names, and other technical literals in their original form when they are identifiers or exact evidence. Use `N/A: <reason>` only when no command applies, and write the reason in Japanese.

The commit script appends exactly one trailer after either form:

```text
Co-authored-by: Cursor <cursoragent@cursor.com>
```

Do not add that trailer manually. The script removes an existing identical
Cursor trailer before appending one.

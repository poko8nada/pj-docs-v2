---
name: implement
description: "Build the unit described in an agreed plan and produce a confirm message listing the changed files. Use when the plan has been agreed via the question tool and the user has said 'go' / '実行'."
compatibility: opencode
---

# implement

Build the unit described in the agreed plan. The plan is the source of truth — do not reopen settled questions, do not expand scope.

## Step 1 — Read rules

Read the reference files relevant to your task. Internalize the rules — do not summarize them in chat.

## References

- TypeScript: `references/typescript.md`
- CSS / Tailwind: `references/css.md`
- Testing: `references/testing.md`
- Markdown: `references/markdown.md`

## Step 2 — Build

Build exactly what the plan's `fileChanges` specifies. Not a stub — correct structure, behavior, and edge cases handled.

Keep the development environment operational at all times. The user should be able to verify the result at any point.

## Step 3 — Verify

Run verification as a single batch after all changes are complete — do not run per-file:

```bash
pnpm typecheck && pnpm lint && pnpm format:check && pnpm test:run
```

## Step 4 — Confirm

List the specific changes: which files, functions, components were created or modified. Note any deviation from the plan (with the user's explicit approval).

## Step 5 — Update annotations

Check if any UO or AN comments in the changed files are now resolved by this implementation:

```bash
grep -rn "UO\[" <changed files> | grep -v "\[done\]"
grep -rn "AN\[" <changed files> | grep -v "\[done\]"
```

- **Still relevant** → leave as is
- **Uncertain** → mention in the confirm message

Do NOT delete comments — only mark [done]. The lefthook handles actual deletion.

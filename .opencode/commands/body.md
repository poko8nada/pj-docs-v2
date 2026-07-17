---
description: Update the issue body with current progress and spec changes at a break point.
---

[body]

# Argument

None. `[body]` updates the issue body with the current state of the work.

# When to use

Run `[body]` at a natural break point:

- After some slices are done
- After a discussion that changed decisions
- Before pausing work or ending the session

It captures the cumulative progress (and, for design, spec changes) in the issue body so the next session can pick up cleanly.

# What it does

For all phases:

- Read the current body
- Mark completed slices as `[x]` in `# <Phase> Progress` / `## Slices`
- Add a one-line entry to `## Notes`
- Post a `## 進捗:` comment on the issue

For design only — also update the spec sections (`# Design Spec (app/web)`):

- `## Style Guide` — refine values if they've changed
- `## Component/Section Matrix` — fill in states/variants as components are built
- `## Implementation Matrix` — fill in hooks/APIs that emerged from discussion
- `## Page Structure` (web only) — fill in additional pages that emerged

# Procedure

1. **Read the current body**:

   ```bash
   gh issue view <number> --json body | jq -r '.body'
   ```

2. **Identify completed slices**: check the codebase for files written in each slice. A slice is "done" if all its components exist in production location with the comment block, and `index.tsx` is updated to compose them.

3. **Modify the progress section** in memory:
   - For each completed slice, change `- [ ] Slice N: ...` to `- [x] Slice N: ...`
   - Add a one-line entry to `## Notes` per completed slice (preserve any existing notes)

4. **For design only — modify the spec sections** based on what's been built or discussed:
   - `## Style Guide`: if the user changed a value, update it
   - `## Component/Section Matrix`: fill in states/variants
   - `## Implementation Matrix`: add hooks/APIs that were decided
   - `## Page Structure` (web only): add pages that were decided

5. **Write back** via heredoc. Preserve all body sections above the progress section untouched:

   ```bash
   gh issue edit <number> --body "$(cat <<'EOF'
   <full modified body>
   EOF
   )"
   ```

6. **Post the `## 進捗:` comment** with a one-line summary:
   ```bash
   gh issue comment <number> --body "## 進捗: <what was done in this update, one line>"
   ```

# Phase differences

| Phase  | Body update content                                                                                                    |
| ------ | ---------------------------------------------------------------------------------------------------------------------- |
| design | progress (Slices + Notes) + spec (Style Guide, Component/Section Matrix, Implementation Matrix, Page Structure if web) |
| build  | progress (Slices + Notes) only                                                                                         |
| refine | progress (Slices + Notes) only                                                                                         |

# Pairing with comment

Pair the `gh issue edit` (body) with the `gh issue comment` (event log) — both happen in the same step, not separately.

# Notes

- The progress section may be empty or missing if the issue was created before the empty Progress section was added to the issue template. In that case, the section is created on first `[body]` update.
- If the body update fails (e.g., body too large for heredoc), fall back to writing to a temp file and using `--body-file`.
- For design, update the spec sections based on what's been built or discussed — don't speculate on future state.
- See `.opencode/skills/issue/references/commands.md` for the full `gh` invocation examples.

# Hard rules

- Always post the `## 進捗:` comment with the body update. Both happen together.
- Preserve all body sections above the progress section untouched. Only the progress section (and design's spec sections) change.
- For design, do not pre-fill Implementation Matrix or Page Structure during the design phase — they are filled only when decisions emerge.
- `[body]` does not execute slices; it only records the current state.

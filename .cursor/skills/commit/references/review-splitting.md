# Review splitting

Use this procedure before reviewing a staged candidate as one or more Intent rows or Units. The Skill owns the logical plan and every split decision. `measure.mjs` only checks the plan against the staged candidate and counts Git diff lines.

## Plan format

First create the complete coarse plan in chat for the user to discuss and confirm.

When an Intent does not need splitting, omit `Units:` and keep one complete Intent row:

```markdown
- Intent: Harnessのレビュー証跡をSkillのcommit flowへ接続する
  - Behavior: PASSのないcommitを拒否する
  - Paths:
    - `.cursor/hooks/lib/review.mjs`
  - Context:
    - `.cursor/hooks/lib/state.mjs`
  - Review: required
  - Lines: 820
  - Note: —
```

When an Intent needs multiple rows, use `Units:`:

```markdown
- Intent: Commit flowのレビュー証跡を整える
  - Behavior: 各レビュー単位の結果を最終Intent commitへ統合する
  - Units:
    - Unit: review-evidence-unit-1
      - Paths:
        - `.cursor/hooks/lib/review.mjs`
      - Context: —
      - Review: required
      - Lines: 820
      - Note: —
    - Unit: review-evidence-unit-2
      - Paths:
        - `.cursor/skills/commit/SKILL.md`
      - Context: —
      - Review: required
      - Lines: pending
      - Note: —
```

- `Intent` is one sentence and is also the final commit identifier.
- `Behavior` is one sentence describing the observable result.
- A single Intent row has no `Unit` ID and uses the Intent integration message.
- A split Intent uses unique Unit IDs derived from the Intent slug: `<intent-slug>-unit-1`, `<intent-slug>-unit-2`, and so on.
- `Paths` contains every file in the user-confirmed candidate. Each path must occur exactly once across the complete plan, including deleted and new files.
- `Context` contains zero or more explicitly named, tracked, clean files that help the reviewer understand the row. Use `Context: —` when none is needed. Context files are not part of the candidate, are not committed, and may be reused by multiple rows.
- `Review` is either `required` or `no_review_required`.
- `Lines` is the Git diff line count (`additions + deletions`) for a required row and `—` for a non-reviewable row.
- `Note` is optional and belongs to the row. Use it only for explicit user-agreed context.
- Context is selected after Intent/Behavior and row boundaries are drafted, before measurement. Prefer only direct one-hop dependencies, types, config, callers/callees, or fixtures that are necessary to understand the row.
- Context paths are exact file paths, never globs. A context file must be tracked and clean; if it is changed, list it in `Paths` instead.
- Keep Context small, normally no more than 3–5 files and about 500 lines total. Context is for interpretation only and does not receive findings.
- Do not add a separate `Group` field. Intent is the final commit identifier.
- A file is indivisible. Never split one file between rows or at hunk level.
- Start with the largest coherent Intent/Behavior grouping, then refine only rows that exceed the applicable target.

If a plan changes, stop the review flow, show the revised complete plan in chat, and obtain agreement again before measuring or reviewing.

## Measurement

Pass the same structured bullets to the measurement script. A single Intent row is valid input:

```sh
node .cursor/skills/commit/scripts/measure.mjs --plan-stdin <<'PLAN'
- Intent: Shared goal
  - Behavior: Observable result
  - Paths:
    - `src/a.mjs`
    - `src/b.mjs`
  - Context:
    - `src/types.mjs`
  - Review: required
  - Lines: pending
  - Note: —
PLAN
```

The script returns one row per Intent or Unit with each file's additions, deletions, and `changedLines`, plus the validated Context paths. It does not modify the index, classify intent, decide reviewability, split rows, create artifacts, invoke a reviewer, or commit. The Skill copies the measured `changedLines` into the chat plan's `Lines` field.

The Skill applies phased limits to required multi-file rows:

- The initial plan targets at most 1,000 Git diff lines.
- After a `REVIEW: GAPS` correction, up to 1,200 Git diff lines is acceptable.
- Multiple files over the applicable limit: split that row into smaller file-level Units, preserving Intent and Behavior where they remain clear.
- One file over the applicable limit, including a new file: keep it as one row; do not create hunk rows.
- A binary or otherwise unmeasurable diff: stop and ask the user how to proceed.
- `no_review_required` rows do not receive a line count and do not invoke a reviewer.

After every refinement, measure the complete revised plan again. Continue only when every required multi-file row is at or below the applicable limit and every single-file exception is explicit.

If a split makes a child row's Intent or Behavior unclear, ask the user for the context and place the agreed reason in that row's `Note`. The Skill passes that Note to `review.mjs` as one `--note` argument. The same mechanism records user-accepted findings and other agreed constraints. A Note is context, not proof of a passing review.

## Review and row commit

After the plan is agreed and measured, each Intent row or Unit is processed independently:

```sh
git restore --staged -- <all-planned-paths>
git add -- <paths-for-one-unit>
node .cursor/skills/commit/scripts/review.mjs [--context <path> ...] [--note "<unit Note>"]
```

The row's staged candidate includes all of its Paths, including `no_review_required` paths. Pass the generated reviewer request unchanged. After `REVIEW: PASS` or `no_review_required`, commit only that row.

For a Unit row, the provisional commit subject is one line:

```text
unit-<intent-slug>-<unit-id>: <short Intent summary>
```

For a single Intent row, use the full Intent Why/What/Verify message from `commit-message.md` instead of the Unit subject. Keep its English subject and write the `Why`, `What`, and `Verify` prose in Japanese. `commit.mjs` adds the Cursor trailer automatically. Do not reuse a hash, request artifact, or reviewer verdict across rows. For review-only requests, process every row and stop before `commit.mjs`.

## Final Intent integration

After every row has a fresh `REVIEW: PASS` or `no_review_required` result and a source commit, the Skill performs one final integration phase. Prepare one manifest group per Intent: `mode: "unit"` contains all provisional Unit commits, while `mode: "intent"` contains the one direct Intent commit. Keep groups in the exact source commit order:

```sh
node .cursor/skills/commit/scripts/integrate.mjs \
  --base <base-commit> \
  --manifest-stdin <<'MANIFEST'
{"groups":[{"intent":"<Intent>","mode":"unit","commits":["<unit-commit-1>","<unit-commit-2>"],"message":"<Intent Why/What/Verify message>"}]}
MANIFEST
```

Include every Intent in the manifest, including a single-row Intent. `integrate.mjs` requires a clean worktree, a contiguous range of linear source commits, the current HEAD at the end of that range, and a valid final message for each Intent. It reconstructs one final commit per Intent and verifies that the final tree is identical. Integration is history organization only. If a hook, tree check, or recovery fails, stop and inspect the reported recovery state.

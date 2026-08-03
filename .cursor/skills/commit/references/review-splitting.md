# Review splitting

Use this procedure before reviewing a staged candidate as one or more Units.
The Skill owns the logical plan and every split decision. `measure.mjs` only
checks the plan against the staged candidate and counts Git diff lines.

## Plan format

First create the complete coarse plan in chat for the user to discuss and
confirm:

```markdown
- Intent: Harnessのレビュー証跡をSkillのcommit flowへ接続する
  - Behavior: PASSのないcommitを拒否する
  - Units:
    - Unit: review-evidence-unit-1
      - Paths:
        - `.cursor/hooks/lib/review.mjs`
      - Context:
        - `.cursor/hooks/lib/state.mjs`
      - Review: required
      - Lines: 820
      - Note: —
```

- `Intent` is one sentence and is also the Group identifier.
- `Behavior` is one sentence describing the observable result.
- `Unit` is a unique ID derived from the Intent slug:
  `<intent-slug>-unit-1`, `<intent-slug>-unit-2`, and so on.
- `Paths` contains every file in the user-confirmed candidate. Each path must
  occur exactly once across the complete plan, including deleted and new files.
- `Context` contains zero or more explicitly named, tracked, clean files that
  help the reviewer understand the Unit. Use `Context: —` when none is needed.
  Context files are not part of the candidate, are not committed, and may be
  reused by multiple Units.
- `Review` is either `required` or `no_review_required`.
- `Lines` is the Git diff line count (`additions + deletions`) for a required
  Unit and `—` for a non-reviewable Unit.
- `Note` is optional and belongs to the Unit. Use it only for explicit
  user-agreed context.
- Context is selected after Intent/Behavior and Unit boundaries are drafted,
  before measurement. Prefer only direct one-hop dependencies, types, config,
  callers/callees, or fixtures that are necessary to understand the Unit.
- Context paths are exact file paths, never globs. A context file must be
  tracked and clean; if it is changed, list it in `Paths` instead.
- Keep Context small (normally no more than 3–5 files and about 500 lines
  total). Context is for interpretation only and does not receive findings.
- Do not add a separate `Group` field. Intent is the Group.
- A file is indivisible. Never split one file between Units or at hunk level.
- Start with the largest coherent Intent/Behavior grouping, then refine only
  rows that exceed the target.

If a plan changes, stop the review flow, show the revised complete plan in
chat, and obtain agreement again before measuring or reviewing.

## Measurement

Pass the same structured bullets to the measurement script:

```sh
node .cursor/skills/commit/scripts/measure.mjs --plan-stdin <<'PLAN'
- Intent: Shared goal
  - Behavior: Observable result
  - Units:
    - Unit: shared-goal-unit-1
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

The script returns one row per Unit with each file's additions, deletions, and
`changedLines`, plus the validated Context paths. It does not modify the index,
classify intent, decide reviewability, split rows, create artifacts, invoke a
reviewer, or commit.
The Skill copies the measured `changedLines` into the chat plan's `Lines`
field.

The Skill compares required Unit totals with the 1,200-line target:

- Multiple files over 1,200 lines: split that Unit into smaller file-level
  Units, preserving Intent and Behavior where they remain clear.
- One file over 1,200 lines: keep it as one Unit; do not create hunk Units.
- A binary or otherwise unmeasurable diff: stop and ask the user how to
  proceed.
- `no_review_required` Units do not receive a line count and do not invoke a
  reviewer.

After every refinement, measure the complete revised plan again. Continue only
when every required multi-file Unit is at or below 1,200 lines and every
single-file exception is explicit.

If a split makes a child Unit's Intent or Behavior unclear, ask the user for
the context and place the agreed reason in that Unit's `Note`. The Skill passes
that Note to `review.mjs` as one `--note` argument. The same mechanism records
user-accepted findings and other agreed constraints. A Note is context, not
proof of a passing review.

## Review and Unit commit

After the plan is agreed and measured, each Unit is processed independently:

```sh
git restore --staged -- <all-planned-paths>
git add -- <paths-for-one-unit>
node .cursor/skills/commit/scripts/review.mjs [--context <path> ...] [--note "<unit Note>"]
```

The Unit's staged candidate includes all of its Paths, including
`no_review_required` paths. Pass the generated reviewer request unchanged.
After `REVIEW: PASS` or `no_review_required`, commit only that Unit.

The provisional Unit commit subject is one line:

```text
unit-<intent-slug>-<unit-id>: <short Intent summary>
```

`commit.mjs` adds the Cursor trailer automatically. Do not reuse a hash,
request artifact, or reviewer verdict across Units. For review-only requests,
process every Unit and stop before `commit.mjs`.

## Optional Intent integration

Unit commits are the review and commit boundary. If the user explicitly asks
to integrate Units sharing one Intent, the Skill prepares one final
Why/What/Verify message from that Intent's Behavior and the Unit results.
Before any history rewrite, verify that:

1. every Unit has a fresh `REVIEW: PASS` or `no_review_required` result;
2. the user confirms the base and exact Unit commit range; and
3. `integrate.mjs` verifies that the final tree before and after integration
   is identical.

Run the history operation only after that confirmation:

```sh
node .cursor/skills/commit/scripts/integrate.mjs \
  --base <base-commit> \
  --commits <unit-commit-1>,<unit-commit-2> \
  --message-stdin <<'MESSAGE'
<Intent Why/What/Verify message>
MESSAGE
```

Integration is history organization only. If the tree differs, stop and
inspect the recovery state before starting a new review candidate. Do not
silently integrate Units during the normal Unit loop.

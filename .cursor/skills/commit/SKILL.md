---
name: commit
description: Review staged changes before an explicit commit, or review staged changes without committing. Use when the user asks to commit or asks for a review-only check. Do not push or create pull requests.
---

# commit

This Skill owns the staged-candidate plan, Intent boundaries, Unit boundaries, review request, review notes, hash artifacts, provisional commits, and final Intent integration. Harness owns gate enforcement and reviewer evidence verification. The reviewer owns review findings and the final `REVIEW: PASS` or `REVIEW: GAPS` verdict. Do not make Harness inject payload content or make the reviewer create a commit.

## Resources

Read these references before using the flow:

- [commit-candidate.md](references/commit-candidate.md) — staged scope and hash semantics
- [review-splitting.md](references/review-splitting.md) — Intent/Behavior, Unit, measurement, and integration contracts
- [review-payload.md](references/review-payload.md) — reviewer handoff and complete artifact contract
- [commit-message.md](references/commit-message.md) — Unit and Intent message formats

Use these scripts from the repository root:

- `node .cursor/skills/commit/scripts/measure.mjs --plan-stdin`
- `node .cursor/skills/commit/scripts/review.mjs [--context <path> ...] [--note "<agreed context>"]`
- `node .cursor/skills/commit/scripts/commit.mjs --message-stdin`
- `node .cursor/skills/commit/scripts/integrate.mjs --base <commit> --manifest-stdin`
- `node .cursor/skills/commit/scripts/smoke.mjs`

## Procedure

### 1. Confirm the delivery intent

- A commit request continues through review, source-row commits, and final Intent integration.
- A review-only request continues through every planned row review and stops before `commit.mjs`.
- An unclear request stops for clarification.

Do not run a reviewer or commit script before the plan is agreed.

### 2. Establish the user-confirmed candidate

Inspect the worktree:

```sh
git status --short
git diff
git diff --cached
```

Determine the exact user-confirmed path range. Preserve staged and unstaged work outside that range. Stage only the agreed paths:

```sh
git add -- <path> ...
git diff --cached --name-status
git diff --cached --stat
```

Never use `git add .` or another broad add. Stop if the staged candidate is empty or contains an unrelated path.

### 3. Build and agree the complete plan

Classify every staged path in the user-confirmed range exactly once:

1. create coarse Intents from one-sentence Intent and Behavior pairs;
2. classify each Intent row as `required` or `no_review_required`;
3. keep one complete Intent row without a `Units:` section when it does not need splitting;
4. add a `Units:` section with unique `<intent-slug>-unit-N` IDs only when an Intent needs two or more review rows;
5. choose any necessary exact, tracked, clean Context files for each reviewable row;
6. list Paths, Context, `Lines: pending`, and optional Note.

Show the complete structured bullet plan in chat before any reviewer or commit invocation. Do not add a `Group` field; Intent is the Group identifier. Discuss the plan with the user and wait for explicit agreement.

If the path set, Intent, Behavior, Unit ID, classification, or split changes, stop and show the complete revised plan again. Obtain agreement again before continuing.

### 4. Measure and refine in the Skill

Pass the agreed plan to the script without reconstructing a payload:

```sh
node .cursor/skills/commit/scripts/measure.mjs --plan-stdin <<'PLAN'
<the complete agreed structured plan>
PLAN
```

The script must only read the staged candidate, validate path coverage and Context files, and report Git diff lines as `additions + deletions` for `required` rows. It must not modify the index, split files, choose logical boundaries, create artifacts, invoke a reviewer, or commit.

Copy each returned `changedLines` total into the plan's `Lines` field and show the complete measured plan in chat. The Skill applies phased limits to each required multi-file row:

- The initial plan targets at most 1,000 Git diff lines.
- After a `REVIEW: GAPS` correction, up to 1,200 Git diff lines is acceptable.
- If a multi-file row exceeds the applicable limit, split it into child Units at file boundaries, preserving the Intent and Behavior where possible.
- If a single file, including a new file, exceeds the applicable limit, keep it as one row. Do not split hunks or duplicate the path.
- If a diff is binary or cannot be measured, stop and ask the user how to proceed.
- Keep `no_review_required` rows without a line count.

For every refinement, rerun measurement for the complete plan. If a split makes a child's Intent or Behavior unclear, obtain the user's agreement for the reason and place it in that Unit's Note. Then pass the Note to the reviewer through one `--note` argument. Notes may also record user-accepted findings or other agreed constraints; they are never proof of review completion.

Proceed to row review only after all rows are within the target or are an explicit single-file exception, and the user has agreed to the measured plan.

### 5. Review and commit one plan row at a time

Before changing the index, stop if a planned path also has unstaged changes; separating that state requires user direction. For each Intent row or Unit:

```sh
git restore --staged -- <all-planned-paths>
git add -- <paths-for-one-row>
node .cursor/skills/commit/scripts/review.mjs [--context <path> ...] [--note "<row Note>"]
```

Pass the row's agreed Context paths as repeated `--context <path>` arguments and parse the JSON result. Do not rebuild the request or create a temporary payload manually.

- `review_required` returns a short reviewer handoff and writes the complete payload to `requestArtifact`.
- `no_review_required` means no staged path in this row matches the reviewable extensions.
- `error` stops the row.

Context paths are read-only reviewer context. They must be exact paths from the agreed plan, must be clean and outside the staged candidate, and are not included in the hash, line count, review scope, or commit.

When `request` is returned, pass that object unchanged to the available `Task` or `functions.Subagent` reviewer route. Do not invoke the reviewer directly, add a model, or pass an ad hoc prompt.

- `REVIEW: PASS` permits the row commit.
- `REVIEW: GAPS` stops the row. Do not commit unchanged. Ask the user to accept specific findings or to request a code correction. If the user accepts a finding or supplies agreed context, rerun `review.mjs` with that context in `--note`; rerun `measure.mjs` first if the Note or Paths changed.

Commit message language follows the boundary between provisional history and final history:

- Unit subjects remain the English mechanical format below.
- Intent integration subjects remain short English imperatives.
- The prose values under `Why`, `What`, and `Verify` in every final Intent message must be Japanese.
- Fixed labels, paths, SHAs, branch names, commands, and test names remain unchanged as technical literals.
- Existing source commit subjects remain unchanged when they are referenced for traceability.

For a commit request after `REVIEW: PASS` or `no_review_required`, use the message format for the row:

```text
unit-<intent-slug>-<unit-id>: <short Intent summary>
```

Use the one-line format only for a Unit row. For a single complete Intent row, prepare the full Intent integration message from `commit-message.md`. Confirm the selected message, then pass it to the commit script:

```sh
node .cursor/skills/commit/scripts/commit.mjs --message-stdin <<'MESSAGE'
unit-<intent-slug>-<unit-id>: <short Intent summary>
MESSAGE
```

For a single complete Intent row, pass its full Why/What/Verify message instead.

`commit.mjs` regenerates the hash from the complete current staged candidate, rejects a missing or different hash, appends the Cursor trailer, and removes the current hash, result, and request artifacts. A Unit commit is provisional; a single Intent commit already uses its final message but is still recorded for the final integration manifest. After a successful row commit, restage only the next row and repeat this step. Never reuse a review artifact or verdict across rows.

### 6. Review-only completion

For a review-only request, report each row's `REVIEW: PASS`, `REVIEW: GAPS`, or `no_review_required` result and stop. Do not run `commit.mjs`, rewrite history, or leave a new commit.

### 7. Integrate all Intents after every row is complete

A commit request is complete only after every planned row has a fresh passing or no-review result, every row has been committed, and the provisional history has been integrated. Record the base commit and each row commit while processing the plan. Build one manifest group per Intent: use `mode: "unit"` with all provisional Unit commits, or `mode: "intent"` with the one direct Intent commit. Keep groups in commit order:

```sh
git log --oneline --reverse <base-commit>..HEAD
node .cursor/skills/commit/scripts/integrate.mjs \
  --base <base-commit> \
  --manifest-stdin <<'MANIFEST'
{"groups":[{"intent":"<Intent>","mode":"unit","commits":["<unit-commit-1>","<unit-commit-2>"],"message":"<Intent Why/What/Verify message>"}]}
MANIFEST
```

Include every Intent in the manifest, including a single-row Intent. `integrate.mjs` requires a clean worktree, a contiguous range of linear source commits, the current HEAD at the end of that range, and a valid final message for each Intent. It reconstructs one final commit per Intent and verifies that the final tree is identical. If a hook, tree check, or recovery fails, stop and report the state; do not accept the integration silently.

### 8. Verify delivery

After the final requested operation:

```sh
git status --short
```

Report the final Intent commits, their source row commits, and remaining staged or unstaged work. Do not push, create pull requests, merge, alter unrelated Harness state, or modify the unrelated `check` flow.

## Artifact lifecycle

Each review run removes stale `.hash`, `.result`, and `.request` artifacts older than seven days by mtime, then replaces the current conversation's artifacts. Review-only artifacts may remain until the next review, commit, or stale-artifact cleanup. A commit run removes the current artifacts after checking the staged hash.

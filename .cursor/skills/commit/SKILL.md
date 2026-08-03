---
name: commit
description: Review staged changes before an explicit commit, or review staged changes without committing. Use when the user asks to commit or asks for a review-only check. Do not push or create pull requests.
---

# commit

This Skill owns the staged-candidate plan, Unit boundaries, review request, review notes, hash artifacts, and Unit commit. Harness owns gate enforcement and reviewer evidence verification. The reviewer owns review findings and the final `REVIEW: PASS` or `REVIEW: GAPS` verdict. Do not make Harness inject payload content or make the reviewer create a commit.

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
- `node .cursor/skills/commit/scripts/integrate.mjs --base <commit> --commits <sha1,sha2,...> --message-stdin`
- `node .cursor/skills/commit/scripts/smoke.mjs`

## Procedure

### 1. Confirm the delivery intent

- A commit request continues through review and Unit commit.
- A review-only request continues through every planned Unit review and stops before `commit.mjs`.
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
2. classify each Unit as `required` or `no_review_required`;
3. assign each Unit a unique `<intent-slug>-unit-N` ID;
4. choose any necessary exact, tracked, clean Context files for each reviewable Unit;
5. list Paths, Context, `Lines: pending`, and optional Note.

Show the complete structured bullet plan in chat before any reviewer or commit invocation. Do not add a `Group` field; Intent is the Group identifier. Discuss the plan with the user and wait for explicit agreement.

If the path set, Intent, Behavior, Unit ID, classification, or split changes, stop and show the complete revised plan again. Obtain agreement again before continuing.

### 4. Measure and refine in the Skill

Pass the agreed plan to the script without reconstructing a payload:

```sh
node .cursor/skills/commit/scripts/measure.mjs --plan-stdin <<'PLAN'
<the complete agreed structured plan>
PLAN
```

The script must only read the staged candidate, validate path coverage and Context files, and report Git diff lines as `additions + deletions` for `required` Units. It must not modify the index, split files, choose logical boundaries, create artifacts, invoke a reviewer, or commit.

Copy each returned `changedLines` total into the plan's `Lines` field and show the complete measured plan in chat. The Skill compares required multi-file Units with the 1,200-line target:

- If a multi-file Unit exceeds 1,200 lines, split it into child Units at file boundaries, preserving the Intent and Behavior where possible.
- If a single file, including a new file, exceeds 1,200 lines, keep it as one Unit. Do not split hunks or duplicate the path.
- If a diff is binary or cannot be measured, stop and ask the user how to proceed.
- Keep `no_review_required` Units without a line count.

For every refinement, rerun measurement for the complete plan. If a split makes a child's Intent or Behavior unclear, obtain the user's agreement for the reason and place it in that Unit's Note. Then pass the Note to the reviewer through one `--note` argument. Notes may also record user-accepted findings or other agreed constraints; they are never proof of review completion.

Proceed to Unit review only after all rows are within the target or are an explicit single-file exception, and the user has agreed to the measured plan.

### 5. Review and commit one Unit at a time

Before changing the index, stop if a planned path also has unstaged changes; separating that state requires user direction. For each Unit:

```sh
git restore --staged -- <all-planned-paths>
git add -- <paths-for-one-unit>
node .cursor/skills/commit/scripts/review.mjs [--context <path> ...] [--note "<Unit Note>"]
```

Pass the Unit's agreed Context paths as repeated `--context <path>` arguments and parse the JSON result. Do not rebuild the request or create a temporary payload manually.

- `review_required` returns a short reviewer handoff and writes the complete payload to `requestArtifact`.
- `no_review_required` means no staged path in this Unit matches the reviewable extensions.
- `error` stops the Unit.

Context paths are read-only reviewer context. They must be exact paths from the agreed plan, must be clean and outside the staged candidate, and are not included in the hash, line count, review scope, or commit.

When `request` is returned, pass that object unchanged to the available `Task` or `functions.Subagent` reviewer route. Do not invoke the reviewer directly, add a model, or pass an ad hoc prompt.

- `REVIEW: PASS` permits the Unit commit.
- `REVIEW: GAPS` stops the Unit. Do not commit unchanged. Ask the user to accept specific findings or to request a code correction. If the user accepts a finding or supplies agreed context, rerun `review.mjs` with that context in `--note`; rerun `measure.mjs` first if the Note or Paths changed.

For a commit request after `REVIEW: PASS` or `no_review_required`, prepare the one-line Unit subject from the Intent:

```text
unit-<intent-slug>-<unit-id>: <short Intent summary>
```

Confirm the subject, then pass it to the commit script:

```sh
node .cursor/skills/commit/scripts/commit.mjs --message-stdin <<'MESSAGE'
unit-<intent-slug>-<unit-id>: <short Intent summary>
MESSAGE
```

`commit.mjs` regenerates the hash from the complete current staged candidate, rejects a missing or different hash, appends the Cursor trailer, and removes the current hash, result, and request artifacts. After a successful Unit commit, restage only the next Unit and repeat this step. Never reuse a review artifact or verdict across Units.

### 6. Review-only completion

For a review-only request, report each Unit's `REVIEW: PASS`, `REVIEW: GAPS`, or `no_review_required` result and stop. Do not run `commit.mjs`, rewrite history, or leave a new commit.

### 7. Optional Intent integration

Unit commits are the normal review and commit boundary. Only when the user explicitly asks for history integration may the Skill prepare an Intent-level Why/What/Verify message. Record the base commit and each resulting Unit commit while processing the plan. Before any history rewrite, verify that every Unit has a fresh passing or no-review result and confirm the exact range with the user:

```sh
git log --oneline --reverse <base-commit>..HEAD
node .cursor/skills/commit/scripts/integrate.mjs \
  --base <base-commit> \
  --commits <unit-commit-1>,<unit-commit-2> \
  --message-stdin <<'MESSAGE'
<Intent Why/What/Verify message>
MESSAGE
```

`integrate.mjs` requires a clean worktree, a contiguous range containing only linear Unit commits, and the current HEAD at the end of that range. It temporarily combines the range, creates the Intent commit, and verifies that the final tree is identical. If the tree differs, it stops and reports the recovery state; start a new review candidate rather than accepting the integration. Do not silently integrate Unit commits during the normal loop.

### 8. Verify delivery

After the final requested operation:

```sh
git status --short
```

Report the Unit commits, any optional integration result, and remaining staged or unstaged work. Do not push, create pull requests, merge, alter unrelated Harness state, or modify the unrelated `check` flow.

## Artifact lifecycle

Each review run removes stale `.hash`, `.result`, and `.request` artifacts older than seven days by mtime, then replaces the current conversation's artifacts. Review-only artifacts may remain until the next review, commit, or stale-artifact cleanup. A commit run removes the current artifacts after checking the staged hash.

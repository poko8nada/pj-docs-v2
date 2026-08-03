---
name: commit
description: Review staged changes before an explicit commit, or review staged changes without committing. Use when the user asks to commit or asks for a review-only check. Do not push or create pull requests.
---

# commit

## Resources

- Read [commit-candidate.md](references/commit-candidate.md) for staged scope and hash semantics.
- Read [review-payload.md](references/review-payload.md) for the reviewer request contract.
- Read [commit-message.md](references/commit-message.md) for the required subject, body, and trailer format.
- Execute [review.mjs](scripts/review.mjs) to create the hash and produce the review result.
- Execute [commit.mjs](scripts/commit.mjs) with the confirmed message on stdin to verify and commit the staged candidate.
- Execute [smoke.mjs](scripts/smoke.mjs) to verify the Skill scripts independently from Harness hooks.

## Procedure

1. Confirm the user's delivery intent.
   - A commit request continues through review and commit.
   - A review-only request stops after the review result and never runs `commit.mjs`.
   - An unclear request stops for clarification.
2. Inspect the current worktree before changing the index.
   - Run `git status --short`.
   - Inspect both `git diff` and `git diff --cached`.
   - Preserve staged or unstaged work that is outside the agreed commit.
3. Establish the exact commit candidate.
   - Ask the user which files belong when ownership or grouping is ambiguous.
   - Stage only the agreed paths with `git add -- <path> ...`.
   - Never use `git add .` or another broad add to absorb unrelated work.
   - Verify the candidate with `git diff --cached --name-status` and `git diff --cached --stat`.
   - Stop if the intended candidate is empty or contains unrelated staged files.
4. Run the review script from the repository root.
   - Execute `node .cursor/skills/commit/scripts/review.mjs`.
   - If the user has explicitly accepted specific findings from an earlier `REVIEW: GAPS`, rerun it with one `--note "<user-approved exclusion>"` argument. Do not add notes based on the agent's own judgment.
   - Parse its JSON result; do not rebuild the request manually.
   - The script hashes the complete staged candidate and overwrites the Skill-local hash artifact.
   - `review_required` returns the complete reviewer `request`.
   - `no_review_required` means no staged path matches the reviewable extensions.
   - An error saying the payload exceeds its limit means the candidate must be split before any reviewer or commit invocation.
   - `error` stops the flow.
5. If a reviewer request is returned, invoke the available reviewer route.
   - Pass the returned `request` object unchanged to `Task` or `functions.Subagent`.
   - Omit `model`, `resume`, and background execution options.
   - Do not invoke the reviewer directly without the generated request.
   - `REVIEW: PASS` permits the commit path; `REVIEW: GAPS` stops it until the user accepts specific findings and the review script is rerun with a note.
6. For review-only, report the review result and finish without running `commit.mjs`.
7. For a commit request after `PASS` or `no_review_required`, prepare the commit message.
   - Read [commit-message.md](references/commit-message.md).
   - Write the required `Why`, `What`, and `Verify` sections from the staged candidate.
   - Confirm the final message before committing.
8. Run the commit script from the repository root.
   - Pass the confirmed multiline message with `--message-stdin` and a heredoc.
   - It regenerates the hash from the complete staged candidate.
   - It rejects a missing or different hash, and removes the hash artifact when it runs.
   - It commits only after the staged hash matches.
9. Verify delivery after a successful script result.
   - Run `git status --short`.
   - Report the commit and any remaining unstaged or staged work.
   - Do not retry a rejected commit unchanged; rerun the review script after correcting the cause.

Each split commit is a new staged candidate and requires a new review-script run. The Skill owns scripts and hashes; Harness monitors script flow and reviewer evidence, but does not inject payloads or create hashes. Do not push, create pull requests, merge, or change product behavior.

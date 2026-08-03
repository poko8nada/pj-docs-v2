# Commit candidate

The staged Git index is the candidate for exactly one Unit commit.

Stage only the files inside the user-confirmed scope before running
`scripts/review.mjs`. Do not let the scripts discover an implicit scope from
unrelated staged or unstaged work.

The Skill hash covers every staged path and the complete staged diff, including
paths outside the reviewable extensions. The reviewer payload is a filtered
view of the same candidate.

The current reviewable extensions are `.ts`, `.tsx`, `.js`, `.jsx`, `.mjs`,
`.cjs`, `.css`, `.html`, `.json`, `.yaml`, and `.yml`. Markdown is intentionally
outside the review set.

The Skill's review split target is 1,200 Git diff lines
(`additions + deletions`) for a Unit containing multiple files. The Skill owns
the target comparison and splitting decision. A single file, including a new
file, may exceed the target because a file is indivisible.

The measurement script does not modify the index, choose boundaries, build a
payload, invoke a reviewer, or commit. It validates that the plan covers every
staged path exactly once and reports additions and deletions for reviewable
Units.

The review script writes the complete diff for the current staged candidate to
an artifact. It never truncates or omits a file. If a complete artifact cannot
be built, it returns an error and does not produce a reviewer request.

Context files are exact, tracked, clean paths outside the staged candidate.
They are listed in the reviewer payload for interpretation only; they do not
change the staged hash, Git diff line count, review scope, or commit contents.

The review script always writes only the `sha256:<hex>` value to the
Skill-local temporary artifact. It returns `no_review_required` when no staged
path matches the reviewable extensions.

The commit script regenerates the hash from the current staged index. It
rejects a missing or different value, commits the staged candidate on a match,
and removes the current review artifacts after execution.

Each Unit is a new staged candidate and requires a new review-script run.

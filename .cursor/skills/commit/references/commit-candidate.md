# Commit candidate

The staged Git index is the candidate for exactly one commit.

Stage only the files that belong to the agreed commit before running `scripts/review.mjs`. Do not let the scripts discover an implicit commit scope from unrelated unstaged work.

The Skill hash covers every staged path and the complete staged diff, including files that are not reviewable. The review payload is a filtered view of the same candidate.

The current reviewable extensions are `.ts`, `.tsx`, `.js`, `.jsx`, `.mjs`, `.cjs`, `.css`, `.html`, `.json`, `.yaml`, and `.yml`. Markdown is intentionally outside the review set.

The review payload limit is 10,000 characters per file and 60,000 characters for the complete payload. The hash is calculated before any payload truncation.

The review script always writes only the `sha256:<hex>` value to the Skill-local temporary artifact. It returns a no-review result when no staged path matches the reviewable extensions.

The commit script regenerates the hash from the current staged index. It rejects a missing or different value, commits the staged candidate on a match, and removes the artifact after execution.

Each split commit has a new staged candidate and requires a new review-script run.

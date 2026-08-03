# Review payload

The review script is the only producer of the reviewer request. The agent must pass the returned `request` object unchanged to the available `Task` or `functions.Subagent` route.

The request contains `description: Pre-commit review`, `subagent_type: pre-commit-reviewer`, and the generated payload as `prompt`.

A valid payload starts with `[commit-review-payload]` and contains `Full Repository Path:`, `Commit Candidate: staged Git index`, and a `Reviewable Files:` list.

When the user has explicitly accepted specific findings from an earlier review, the payload may also contain an `Accepted exclusions:` section supplied through the review script's `--note` argument. Treat it as user-approved context for this review only, not as evidence that the excluded behavior was reviewed.

Each listed file must have a corresponding complete diff section. If either character limit would truncate a section, the review script returns an error instead of producing a reviewer request; split the staged candidate first.

Existing-file diffs are limited to 10,000 characters per file. New-file content is included without that per-file limit, but the complete payload is limited to 60,000 characters.

The reviewer must review only the supplied diff text. It must not run Git commands or inspect unrelated repository files.

When the payload marker or required fields are missing, the reviewer must not attempt a repository-wide review. It must report the invalid invocation and finish with exactly `REVIEW: GAPS`.

The reviewer must finish a valid review with exactly one verdict line: `REVIEW: PASS` or `REVIEW: GAPS`.

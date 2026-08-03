# Review payload

The review script is the only producer of the reviewer request and payload artifact. The agent must pass the returned `request` object unchanged to the available `Task` or `functions.Subagent` route.

The request contains `description: Pre-commit review`, `subagent_type: pre-commit-reviewer`, and a short `prompt` containing `Review Payload Artifact: <absolute path>`. The artifact path is the only review input path; the agent must not replace it with an ad hoc file.

The generated artifact starts with `[commit-review-payload]` and contains `Full Repository Path:`, `Commit Candidate: staged Git index`, and a `Reviewable Files:` list.

When the user has explicitly accepted specific findings from an earlier review, the artifact may also contain an `Accepted exclusions:` section supplied through the review script's `--note` argument. Treat it as user-approved context for this review only, not as evidence that the excluded behavior was reviewed.

The reviewer must read exactly the generated artifact named by the handoff, then validate that each listed file has a corresponding complete diff section. If either character limit would truncate a section, the review script returns an error instead of producing a reviewer request; split the staged candidate first.

Existing-file diffs are limited to 10,000 characters per file. New-file content is included without that per-file limit, but the complete payload is limited to 60,000 characters.

The reviewer must review only the artifact's supplied diff text. It must not run Git commands or inspect unrelated repository files.

When the handoff, artifact marker, or required fields are missing, the reviewer must not attempt a repository-wide review. It must report the invalid invocation and finish with exactly `REVIEW: GAPS`.

The reviewer must finish a valid review with exactly one verdict line: `REVIEW: PASS` or `REVIEW: GAPS`.

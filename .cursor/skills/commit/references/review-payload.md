# Review payload

The review script is the only producer of the reviewer request and payload
artifact. The Skill must pass the returned `request` object unchanged to the
available `Task` or `functions.Subagent` route.

The request contains `description: Pre-commit review`,
`subagent_type: pre-commit-reviewer`, and a short `prompt` containing
`Review Payload Artifact: <absolute path>`. The artifact path is the only
payload handoff; the Skill must not replace it with an ad hoc file.

The generated artifact starts with `[commit-review-payload]` and contains:

- `Full Repository Path:`
- `Commit Candidate: staged Git index`
- an optional `Context Files:` list
- a `Reviewable Files:` list
- one complete `diff` section for every listed path

The payload contains the complete staged diff for the current Intent row or Unit. There is no character-based truncation or omission fallback. If any listed diff cannot be included completely, `review.mjs` returns `status: error` and does not write a reviewer request.

Context files are listed by exact path and are tracked, clean files outside the
staged candidate. Their contents are not copied into the payload, are not
hashed or committed, and are supplied only so the reviewer can read necessary
one-hop context. The reviewer must not report findings against Context files.

When the Skill has user-agreed context for the current review, the artifact
may also contain a `Review notes:` section supplied through one `--note` argument. It may explain an accepted finding, an agreed design constraint, or why a row was split. Treat it as context for this review only, not as evidence that the supplied diff was reviewed or that a finding is resolved.

The reviewer must read exactly the generated artifact named by the handoff,
then validate that each listed file has a corresponding complete diff section.
If `Context Files:` is present, the reviewer may read exactly those listed
tracked files for interpretation. It must not run Git commands, discover other
files, or inspect unrelated repository files.

When the handoff, artifact marker, required fields, or complete diff sections
are missing, the reviewer must not attempt a repository-wide review. It must
report the invalid invocation and finish with exactly `REVIEW: GAPS`.

The reviewer must finish a valid review with exactly one verdict line:
`REVIEW: PASS` or `REVIEW: GAPS`.

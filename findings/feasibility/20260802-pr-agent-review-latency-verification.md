# PR-Agent Review Latency Verification

Date: 2026-08-02

## Purpose

This Markdown-only change verifies the latency of the PR-Agent workflow after
the runtime image and OpenRouter reasoning configuration were updated on
`main`.

The change intentionally avoids application logic so the measurement reflects
the review path used by a documentation-heavy pull request.

## Measurement protocol

1. Record the pull request creation time.
2. Keep the pull request unchanged while the first review runs.
3. Record the workflow run URL and the `Run PR Agent` step duration.
4. Record whether the primary model completed or the fallback model ran.
5. Record the time when the review comment became visible.

## Acceptance criteria

- The workflow completes successfully.
- The total time from pull request creation to the review comment is about two
  minutes or less for this Markdown-heavy change.
- The workflow uses the pinned PR-Agent v0.41.0 image digest from `main`.
- The review log does not show an unexpected model fallback or timeout.

## Run record

- Pull request:
- Workflow run:
- Created at:
- Review published at:
- Total duration:
- `Run PR Agent` duration:
- Model path:
- Result:

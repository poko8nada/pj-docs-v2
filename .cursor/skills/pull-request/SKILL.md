---
name: pull-request
description: Creates or updates a GitHub pull request and verifies this repository's PR-Agent workflow so completed changes can be reviewed. Use when the user explicitly asks to create or update a pull request in this repository. Do not use for ordinary commits, review-only inspection, or unrequested secret registration.
---

# Pull Request

## Purpose

Use this skill when creating or updating a pull request in this repository.
The repository workflow runs PR-Agent only for pull requests whose head branch belongs to the same repository.

## Workflow

1. Inspect the worktree and the complete branch diff before creating the pull request.
   Do not include `.envrc`, API keys, or other credentials.
2. Check whether the repository secret is available:

   ```bash
   node .cursor/skills/pull-request/scripts/setup-pr-agent-secret.mjs --check
   ```

3. If the check reports that `OPENROUTER_API_KEY` is missing, explain that the value must be exported in the current shell and ask for explicit confirmation before registering it. After confirmation, run:

   ```bash
   node .cursor/skills/pull-request/scripts/setup-pr-agent-secret.mjs
   ```

   The script reads only the current process environment, sends the value to `gh secret set` through stdin, and never prints the value.

4. Push the branch and create or update the pull request with `gh`. Use the repository's default branch unless the user specifies another base.
5. Report the pull request URL and whether the secret check passed. Do not claim that PR-Agent ran until a GitHub Actions run confirms it.
6. Set `HEAD_SHA=$(git rev-parse HEAD)` and find the Actions run for the pushed commit instead of matching only by branch:

   ```bash
   gh run list --workflow pr-agent-review.yml --commit "$HEAD_SHA" --limit 1 --json databaseId,status,conclusion,url
   ```

7. By default, report the run URL and current status without waiting for completion. If the user asks to wait, watch that specific run:

   ```bash
   gh run watch <run-id> --exit-status --interval 5
   ```

   A foreground watch blocks the current shell action. Start it in the background only when the agent needs to continue other independent work, and never start a duplicate watcher for the same run.

8. After the run completes, inspect its conclusion and the PR comments. Report the result and comment URL, and do not claim that PR-Agent reviewed the change while the run is still in progress.

## Review follow-up

Treat AI review comments as hypotheses, not automatic change requests.

1. Classify each finding as a valid issue, an already-handled or false-positive finding, or an intentional out-of-scope tradeoff.
2. Verify the finding against the current code and tests before changing anything. Quote the relevant symbol or behavior when recording the decision.
3. If the finding is valid, fix it on the branch, add a regression test when behavior is affected, push the change, and run the commit-specific Actions verification above.
4. If the finding is already handled or false positive, do not change code just to satisfy it. Reply with the concrete evidence. Resolve an inline review thread when GitHub offers that action; for a PR-level bot comment, record the disposition in a reply.
5. If the finding is out of scope, state that decision explicitly and defer it rather than silently ignoring it.
6. If the pull request is already merged, create a follow-up branch and pull request for code changes instead of reopening the merged pull request.

Inspect the PR-level review record with:

```bash
gh pr view "$PR_URL" --json comments,reviews,statusCheckRollup
```

Record a disposition as a PR-level comment with:

```bash
gh pr comment "$PR_URL" --body-file - <<'EOF'
## Review follow-up

- Finding: <short description>
- Decision: <fixed, already handled, false positive, or out of scope>
- Evidence: <relevant symbol, behavior, or test>
- Action: <follow-up PR, no code change, or deferred>
EOF
```

This comment works on merged pull requests and documents the decision, but it does not rerun this repository workflow because the workflow listens to `pull_request` events rather than `issue_comment`. Push a code change to trigger a new review.

## Security boundaries

- The workflow uses `pull_request`, not `pull_request_target`.
- Fork pull requests are intentionally skipped, so their code cannot use this repository's OpenRouter secret.
- Do not add `pull_request_target` or check out fork code in a privileged job without a new, explicit security decision.
- Keep `OPENROUTER_API_KEY` in the local ignored environment or GitHub Secrets.
  Never put it in a file tracked by Git.
- An Actions watcher is session-scoped monitoring, not a persistent GitHub notification or webhook.

## Utility script

`scripts/setup-pr-agent-secret.mjs` supports:

- `--check`: verifies the secret name exists without reading or requiring its value.
- no argument: registers the current `OPENROUTER_API_KEY` value and verifies the secret name afterward.

The companion smoke test uses a fake `gh` runner and never contacts GitHub:

```bash
node .cursor/skills/pull-request/scripts/setup-pr-agent-secret.smoke.mjs
```

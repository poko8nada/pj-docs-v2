---
name: pull-request
description: Creates or updates a GitHub pull request and verifies this repository's PR-Agent workflow so completed changes can be reviewed. Use when the user explicitly asks to create or update a pull request in this repository. Do not use for ordinary commits, review-only inspection, or unrequested secret registration.
---

# Pull Request

## Purpose

Use this skill when creating or updating a pull request in this repository.
The repository workflow runs PR-Agent only for pull requests whose head branch belongs to the same repository.
The Commit Skill owns Unit review and Intent integration commits. This Skill owns grouping those complete Intent commits into content-based pull request candidates.

Read [content-grouping.md](references/content-grouping.md) before preparing a pull request.

Use these scripts from the repository root:

- `node .cursor/skills/pull-request/scripts/inventory.mjs --base <commit>`
- `node .cursor/skills/pull-request/scripts/inventory.mjs --base <commit> --head <delivery-head>`
- `node .cursor/skills/pull-request/scripts/inventory.mjs --base <commit> --head <delivery-head> --proposal-stdin`
- `node .cursor/skills/pull-request/scripts/prepare.mjs --base <commit> --head <delivery-head> --mode <A|B|C> --proposal-stdin`
- `node .cursor/skills/pull-request/scripts/push.mjs --pr <pr-id> --prepared-stdin`
- `node .cursor/skills/pull-request/scripts/push.mjs --all --prepared-stdin`
- `node .cursor/skills/pull-request/scripts/pr.mjs --published-stdin`
- `node .cursor/skills/pull-request/scripts/inventory.smoke.mjs`
- `node .cursor/skills/pull-request/scripts/prepare.smoke.mjs`
- `node .cursor/skills/pull-request/scripts/push.smoke.mjs`
- `node .cursor/skills/pull-request/scripts/pr.smoke.mjs`

## Language

- Keep field labels and section headings in their fixed English format.
- Write generated prose in Japanese: PR titles, proposal `Intent`, `Behavior`, `Note`, and review follow-up explanations.
- Keep Paths, SHAs, branch names, PR IDs, commands, test names, and source commit subjects as exact technical values.
- Do not translate source commit subjects; they are history data included for traceability.

## Workflow

1. Inspect the clean worktree, the confirmed base, the agreed delivery head, and the current `HEAD` before creating a pull request.
   A delivery head may be behind the current `HEAD`; report those later commits as deferred and do not include them.
   Do not include `.envrc`, API keys, or other credentials.
2. Treat each completed Intent integration commit as one indivisible source candidate.
   Run `inventory.mjs --head <delivery-head>` to establish the exact `base..delivery-head` source commit, Path, and line-count inventory.
3. Build all three proposals from the same source inventory:
   A — one pull request from the current branch,
   B — source-order contiguous ranges as stacked pull requests,
   C — content-first candidates using temporary branches and complete-commit cherry-picks.
   Include each proposal's Intent, Behavior, source commits, Paths, refs, dependencies, branch operation, and Notes.
   Write the generated Intent, Behavior, and Note sentences in Japanese; preserve source commit subjects exactly.
4. Pass all three proposals to `inventory.mjs --proposal-stdin` and stop on any validation error.
5. Show all three validated proposals in chat and ask the user to select A, B, or C.
   Do not recommend or execute one automatically. Do not create branches, cherry-pick, push, or run `gh` before the selection.
6. After the user selects a mode, pass the complete proposal JSON and the same delivery head to `prepare.mjs`.
   The script revalidates the source range and selected proposal before making any local ref change.
   Preparation does not push or call `gh`.
   It performs these mode-specific operations:
   - A keeps the current named branch when it points at the delivery head and replaces `<current-branch>` with its actual name.
     If local `HEAD` is later, it may reuse an existing remote head at the agreed boundary but must not force-push backward.
   - B creates one local intermediate branch per contiguous source range and keeps source order.
   - C creates one temporary worktree per content candidate, cherry-picks complete source commits, records the source-to-prepared mapping, and removes the worktree while retaining the prepared branch.
     A preparation failure must leave the current worktree unchanged; resolve any reported cleanup failure before continuing.
7. Check whether the repository secret is available:

   ```bash
   node .cursor/skills/pull-request/scripts/setup-pr-agent-secret.mjs --check
   ```

8. If the check reports that `OPENROUTER_API_KEY` is missing, explain that the value must be exported in the current shell and ask for explicit confirmation before registering it. After confirmation, run:

   ```bash
   node .cursor/skills/pull-request/scripts/setup-pr-agent-secret.mjs
   ```

   The script reads only the current process environment, sends the value to `gh secret set` through stdin, and never prints the value.

9. Publish only the selected PR heads with `push.mjs`.
   Use repeated `--pr <pr-id>` for a partial delivery or `--all` for every candidate.
   Dependencies must be selected together. The script skips a head already at the expected delivery SHA and never force-pushes.
   If a later head fails, stop and report the heads published before the failure; do not run `pr.mjs` with an incomplete result.
   Do not run `pr.mjs` until this step returns successful publication results.

   ```bash
   node .cursor/skills/pull-request/scripts/push.mjs \
     --pr <pr-id> --pr <pr-id> \
     --prepared-stdin < prepared.json > published.json
   ```

10. Pass the published JSON to `pr.mjs`.
    It creates or updates only the published PRs by `base` and `head`.
    The body preserves the candidate Intent, Behavior, Paths, source commits, dependencies, and C-mode commit mapping.
    Do not run `gh pr create` manually with a different grouping.
11. Report the pull request URLs and whether the secret check passed. Do not claim that PR-Agent ran until a GitHub Actions run confirms it.
12. For each returned PR URL, read its actual head SHA and find the Actions run for that pushed commit instead of matching only by branch:

```bash
HEAD_SHA=$(gh pr view "$PR_URL" --json headRefOid --jq .headRefOid)
gh run list --workflow pr-agent-review.yml --commit "$HEAD_SHA" --limit 1 --json databaseId,status,conclusion,url
```

13. By default, report each run URL and current status without waiting for completion. If the user asks to wait, watch that specific run:

```bash
gh run watch <run-id> --exit-status --interval 5
```

A foreground watch blocks the current shell action. Start it in the background only when the agent needs to continue other independent work, and never start a duplicate watcher for the same run.

14. After the run completes, inspect its conclusion and the PR comments. Report the result and comment URL, and do not claim that PR-Agent reviewed the change while the run is still in progress.

## Review follow-up

Treat AI review comments as hypotheses, not automatic change requests.

1. Classify each finding as a valid issue, an already-handled or false-positive finding, or an intentional out-of-scope tradeoff.
2. Verify the finding against the current code and tests before changing anything. Quote the relevant symbol or behavior when recording the decision.
3. If the finding is valid, fix it on the branch, add a regression test when behavior is affected, push the change, and run the commit-specific Actions verification above.
4. If the finding is already handled or false positive, do not change code just to satisfy it. Reply with the concrete evidence in Japanese. Resolve an inline review thread when GitHub offers that action; for a PR-level bot comment, record the disposition in a reply.
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

- Finding: <発見内容を日本語で記載>
- Decision: <対応内容を日本語で記載>
- Evidence: <根拠となるsymbol、挙動、またはtestを日本語で記載>
- Action: <対応内容を日本語で記載>
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

`scripts/prepare.mjs`, `scripts/push.mjs`, and `scripts/pr.mjs` form the execution boundary:

- `prepare.mjs` accepts only the selected, previously validated proposal and emits prepared PR refs as JSON without remote side effects.
- `push.mjs` publishes only explicitly selected heads and emits publication evidence.
- `pr.mjs` accepts only publication evidence and updates or creates the matching PRs without running Git push.
- The smoke tests use isolated Git repositories and fake `gh`/push runners; they never contact GitHub.

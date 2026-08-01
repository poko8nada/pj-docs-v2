---
name: pull-request
description: Creates GitHub pull requests with the repository's PR-Agent workflow, checks the OPENROUTER_API_KEY repository secret, and registers it from the local environment when needed. Use when creating or updating a pull request in this repository.
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

## Security boundaries

- The workflow uses `pull_request`, not `pull_request_target`.
- Fork pull requests are intentionally skipped, so their code cannot use this repository's OpenRouter secret.
- Do not add `pull_request_target` or check out fork code in a privileged job without a new, explicit security decision.
- Keep `OPENROUTER_API_KEY` in the local ignored environment or GitHub Secrets.
  Never put it in a file tracked by Git.

## Utility script

`scripts/setup-pr-agent-secret.mjs` supports:

- `--check`: verifies the secret name exists without reading or requiring its value.
- no argument: registers the current `OPENROUTER_API_KEY` value and verifies the secret name afterward.

The companion smoke test uses a fake `gh` runner and never contacts GitHub:

```bash
node .cursor/skills/pull-request/scripts/setup-pr-agent-secret.smoke.mjs
```

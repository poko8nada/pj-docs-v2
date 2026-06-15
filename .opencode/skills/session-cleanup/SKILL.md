---
name: session-cleanup
description: Trigger when the user wants to end or pause the session, mentions closing out, or asks to clean up git / issues / documents. Handles two patterns — full session end (commit, push, PR, branch cleanup) and work pause (stash WIP for next session). Use proactively when user signals they are wrapping up, but do not infer the pattern silently — ask which one applies.
---

# Skill: session-cleanup

Clean up the working state of the current session. Two patterns, chosen explicitly by the user.

Document updates must happen **before** the commit, otherwise the cleanup is incomplete.

## Step 1 — Ask the pattern

Use the `question` tool to confirm which pattern applies. Do not guess.

- **Pattern A — End session** — commit remaining work, push, open or finalize a PR, clean up the branch
- **Pattern B — Pause session** — stash uncommitted work as WIP, keep the branch and state for next session

The user may also choose to do nothing for some items. Each step below ends with a per-item decision.

## Step 2 — Document update (before commit)

Check project documents that should reflect this session's work.

- **`README.md`** at the project root — does it need updates? (API changes, new commands, new dependencies, changed setup steps)
- **Other project documents** — search for `.md` / `.mdx` / `.mdc` files in the project root and direct subfolders. Common patterns: `docs/`, `*draft*.md`, `**.md`, PJ-specific files. The user identifies which ones matter; the agent does not guess.

For each document that needs updating, present the proposed change and ask for approval. Stage the approved changes alongside the work — they must land in the same commit.

## Step 3 — Git state and commit

Run `git status` and `git diff --cached`. Present the staged and unstaged changes.

- **Commit message** — propose a message based on the diff. Use conventional commit format if the project uses it.
- **Stage selection** — what to include? Anything left unstaged stays for the next session (Pattern B) or must be addressed now (Pattern A).

After the commit, lefthook's pre-commit hook runs format and lint. With `stage_fixed: true` on the format command, formatter changes are auto-staged, so a single commit lands the work clean.

## Step 4 — Push (Pattern A only)

Run `git log --oneline @{u}..` to find unpushed commits. If any exist, propose `git push` to the current branch.

Skip this step for Pattern B.

## Step 5 — PR decision (Pattern A only)

If the current branch has unpushed commits and is not main, suggest opening or updating a PR.

- Use `gh pr create --draft` by default — the work is in a reviewable state but not requesting review yet
- Body: summarize the commits
- If a draft PR exists, ask whether to mark it ready (`gh pr ready`)

Skip this step for Pattern B.

## Step 6 — Issue state

Run `gh issue list --state open --limit 10` and `gh pr list --state open --limit 10`. Present findings as a checklist.

- **Open issues touched this session** — add a progress comment, close, or leave
- **Open PRs** — note status, request review, or leave

## Step 7 — Branch cleanup (Pattern A only)

List merged work branches (`git branch --merged main`). For each:

- Delete the branch locally (`git branch -d`)
- Delete the remote branch if it exists (`git push origin --delete`)

Skip this step for Pattern B.

## Step 8 — Stash handling (Pattern B only)

If `git stash list` shows entries from a previous session cleanup, ask:

- Pop the stash and continue
- Keep the stash and start fresh
- Drop the stash (only if the work is no longer needed)

Skip this step for Pattern A.

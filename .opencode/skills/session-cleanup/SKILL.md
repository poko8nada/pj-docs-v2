---
name: session-cleanup
description: "Clean up the working state at session end. Walks through document updates, git commit/push, PR decision, issue updates, and branch cleanup. Trigger when the user wants to end or pause the session."
---

# session-cleanup

Clean up the working state of the current session. The order matters — document updates must land in the same commit as the work, and issue updates happen after the work is committed.

## Step 1 — Document update

Check project documents that should reflect this session's work.

- **`README.md`** at the project root — does it need updates? (API changes, new commands, new dependencies, changed setup steps). README should only contain external-facing content (Overview, Getting Started, Usage, Contributing, License). Internal planning goes in the Spec.
- **Other project documents** — search for `.md` / `.mdx` / `.mdc` files in the project root and direct subfolders. Common patterns: `docs/`, `*draft*.md`, PJ-specific files. The user identifies which ones matter; the agent does not guess.

For each document that needs updating, present the proposed change and ask for approval. Stage the approved changes alongside the work — they must land in the same commit.

## Step 2 — Git state, commit, push

Run `git status` and `git diff --cached`. Present the staged and unstaged changes.

- **Commit message** — propose a message based on the diff. Use conventional commit format if the project uses it.
- **Stage selection** — what to include? Anything left unstaged stays for the next session.
- **Push** — propose `git push` to the current branch if there are unpushed commits (`git log --oneline @{u}..`).

The user decides per item. Do not auto-commit, auto-push, or auto-stage.

## Step 3 — PR decision

If the current branch has unpushed commits and is not main or develop, suggest opening or updating a PR.

- Use `gh pr create --draft` by default — the work is in a reviewable state but not requesting review yet
- Body: summarize the commits
- If a draft PR exists, ask whether to mark it ready (`gh pr ready`)

The user confirms before any PR action.

## Step 4 — Issue updates (trigger issue skill)

If tracking issues exist for this session's work, hand off to the `issue` skill. Do not duplicate the issue skill's logic here. The issue skill handles:

- Closing completed Task issues
- Adding progress comments to incomplete Tasks
- Updating the parent Spec with completion summaries

The handoff is: call the `issue` skill from the chat. Issue comments, formatting, and Spec/Task lifecycle are the issue skill's responsibility.

## Step 5 — Branch cleanup

If the current branch is **not** `main` or `develop`, list merged work branches and propose cleanup:

- Delete the branch locally (`git branch -d`)
- Delete the remote branch if it exists (`git push origin --delete`)

The user confirms before any branch deletion. If the branch is still in use, skip it.

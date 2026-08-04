# Content-based pull request proposals

The Pull Request Skill always creates three proposals from the same completed Intent integration commits. The user chooses A, B, or C before any branch operation, cherry-pick, push, or `gh` command.

## Candidate boundary

- The candidate starts at a user-confirmed base commit and ends at an explicit delivery head.
- The delivery head may be behind the current local `HEAD`; later committed changes are deferred and outside the candidate.
- Source candidates are committed Intent integration commits. Uncommitted changes are outside this contract.
- Each proposal accounts for every source commit exactly once.
- A source commit is indivisible. Its files, diff hunks, and message stay together.
- The Commit Skill owns splitting an Intent before integration. The Pull Request Skill never splits an Intent integration commit.
- A proposal may contain one source commit when that Intent is already a complete reviewable concern.

## Inventory and validation

Run the inventory script before drafting proposals:

```sh
node .cursor/skills/pull-request/scripts/inventory.mjs \
  --base <base-commit> \
  --head <delivery-head>
```

The script requires a clean worktree, a linear `base..delivery-head` range, and a valid Why/What/Verify message for every source commit. It returns each commit's full SHA, parent, subject, Paths, per-file additions and deletions, measurable Git diff lines, and any deferred commits between the delivery head and current `HEAD`.

After drafting all three proposals, pass the same JSON plan back to the script:

```sh
node .cursor/skills/pull-request/scripts/inventory.mjs \
  --base <base-commit> \
  --head <delivery-head> \
  --proposal-stdin
```

Validation requires every proposal to account for every source commit exactly once. It checks PR fields, Path unions, mode-specific branch operations, source-order contiguity for B, and known dependencies. It does not create branches, cherry-pick, push, or call `gh`. Its JSON result keeps the original plan under `plan`, so the validated plan can be handed to `prepare.mjs`.

## Three proposals

### A — single pull request

- Keep the current branch and source commit order unchanged.
- Create one pull request from the publishable head at the delivery boundary.
- If the current branch has later local commits, reuse an existing remote head at that boundary; never force-push the branch backward.
- Use an abstract PR-level Intent and Behavior, while listing each source Intent for traceability.
- Do not create a branch or cherry-pick.

### B — source-order stacked pull requests

- Keep source commit order unchanged.
- Partition source commits into contiguous ranges.
- Create intermediate branch refs and stacked pull requests for those ranges.
- Use PR dependencies to express the merge order.
- Do not cherry-pick or rewrite source commits.

### C — content-first pull requests

- Group source commits by the strongest content, intent, reviewer, and dependency boundaries.
- Allow a PR candidate to contain non-contiguous source commits.
- Create a temporary branch or worktree for each candidate.
- Cherry-pick complete Intent integration commits into the candidate branch.
- Record the source-to-cherry-picked commit mapping.

## Proposal format

Show all three complete proposals in chat before running `gh`:

```markdown
## Mode A — single pull request

- PR: all-content
  - Intent: 完了した変更を一つの成果として統合する
  - Behavior: 合意した変更全体を確認できる状態になる
  - Commits:
    - `<sha-1>` Align review evidence
    - `<sha-2>` Finalize review contract
  - Paths:
    - `.cursor/skills/commit/SKILL.md`
    - `.cursor/skills/commit/scripts/review.mjs`
  - Base: `develop`
  - Head: `<current-branch>`
  - Branch operation: none
  - Depends on: —
  - Note: —

## Mode B — source-order stacked pull requests

- PR: review-contract
  - Intent: レビュー根拠をcommitフローに接続する
  - Behavior: すべての最終commitに明示的なレビュー境界がある
  - Commits:
    - `<sha-1>` Align review evidence
  - Paths:
    - `.cursor/skills/commit/SKILL.md`
  - Base: `develop`
  - Head: `<temporary-branch-1>`
  - Branch operation: intermediate branch
  - Depends on: —
  - Note: —

## Mode C — content-first pull requests

- PR: review-contract
  - Intent: レビュー根拠をcommitフローに接続する
  - Behavior: すべての最終commitに明示的なレビュー境界がある
  - Commits:
    - `<sha-1>` Align review evidence
    - `<sha-3>` Finalize review evidence
  - Paths:
    - `.cursor/skills/commit/SKILL.md`
  - Base: `develop`
  - Head: `<temporary-branch-1>`
  - Branch operation: temporary branch and cherry-pick
  - Depends on: —
  - Note: —
```

- `Mode` is the user-selectable execution policy, not an automatic recommendation.
- `PR` is a stable identifier used for later commands and discussion.
- `Intent` is one sentence describing the candidate's purpose.
- `Behavior` is one sentence describing the observable result after the pull request is merged.
- `Commits` lists complete Intent integration commits and never splits one.
- `Paths` is the union of paths changed by the listed commits and explains the review surface.
- `Base` and `Head` identify the refs used for the proposed pull request.
- The inventory `delivery head` identifies the commit boundary; it is not silently replaced with the current local `HEAD`.
- `Branch operation` states whether the option changes refs or creates a temporary worktree.
- `Depends on` lists PR identifiers that must land first, or `—`.
- `Note` records an agreed grouping reason, dependency, or constraint. It is not review evidence.

## Language

- Keep field labels and section headings in their fixed English format.
- Write generated prose in Japanese: PR titles, `Intent`, `Behavior`, `Note`, and review follow-up explanations.
- Keep Paths, SHAs, branch names, PR IDs, commands, test names, and source commit subjects as exact technical values.
- Do not translate a source commit subject when listing it for traceability; it is history data, not newly generated prose.

## Execution after selection

Only the selected proposal is executed:

```sh
node .cursor/skills/pull-request/scripts/prepare.mjs \
  --base <base-commit> \
  --head <delivery-head> \
  --mode <A|B|C> \
  --proposal-stdin < proposals.json > prepared.json
node .cursor/skills/pull-request/scripts/push.mjs \
  --pr <pr-id> \
  --prepared-stdin < prepared.json > published.json
node .cursor/skills/pull-request/scripts/pr.mjs \
  --published-stdin < published.json
```

- A resolves `<current-branch>` to the current named branch when it points at the delivery head. If the local branch has later commits, an existing remote head at the delivery boundary may be reused; the Skill must not force-push the branch backward.
- B creates one local branch per source-order range at the range's last source commit. The next PR uses the preceding prepared branch as its base.
- C creates each candidate in an isolated temporary worktree, cherry-picks its complete source commits in listed order, records the resulting commit mapping, removes the worktree, and retains the candidate branch for push.
- Preparation revalidates the selected proposal. A failure must not leave the current worktree in a cherry-pick state.
- `push.mjs` publishes only selected PR heads, skips an already matching remote head, and rejects a local head outside the delivery boundary.
- If a later selected head fails, it reports the heads published before the failure and stops before PR creation.
- `pr.mjs` accepts only successful publication results, creates or updates those PRs by base and head, and writes the candidate details into the PR body.

## Proposal rules

- Build A, B, and C from the same source commit inventory; do not omit an option because it is less convenient.
- A may use a more abstract Intent, but it must not hide unrelated concerns. List source Intents in the proposal.
- B may combine otherwise separate concerns when source order makes a narrower contiguous range impossible. State that constraint in `Note`.
- C may prioritize content boundaries over source order, but every cherry-picked commit must remain complete and traceable.
- Keep implementation, tests, and directly coupled documentation together when they describe one behavior.
- Do not group changes only because they occurred on the same branch or in the same session.
- Any change to source commits, grouping, dependency, or scope requires showing all three revised proposals again.
- Do not perform branch construction or GitHub operations before the user selects a mode.
- A partial delivery is complete only for its selected PR heads; deferred local commits remain outside the PR and must be reported.

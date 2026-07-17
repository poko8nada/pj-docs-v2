# refine

**These are the plans required prior to implementation. Need to create specific outputs.**

Plan that survives contact with the codebase. The refinement plan must reconcile them with what is actually in the repo, and the user must explicitly agree before the plan is locked.

## Tool usage policy

This skill uses a strict tool policy to keep the flow natural and the user in control:

- **`question` tool — Step 4 only.** Use it exactly once for the final consensus prompt. Do not use it to advance Step 1 or Step 2.
- **`todowrite` tool — Step 2 only.** Use it to publish the 5-section plan checklist. The user reads the checklist to follow progress.
- **`read` / `glob` / `grep` — Step 1 only.** Use them to reconcile research findings with the actual codebase. Not a free-for-all in later steps.
- **Chat text — natural dialogue.** Surface findings, ask clarifying questions, and present the final plan in chat.

## Step 1: Analyze existing code (REQUIRED)

This step exists because refinement must be grounded in what the code actually does. Improvements must target real issues, not hypothetical ones.

Do the following:

1. **Locate the relevant code** with `read` / `glob` / `grep`. Find the actual files, functions, and call sites that the refinement will touch or rely on.
2. **Identify improvement areas.** Look for:
   - Code duplication
   - Long functions or complex conditionals
   - Missing error handling
   - Performance bottlenecks
   - Inconsistent patterns
   - Missing tests
   - Outdated dependencies or patterns
3. **Prioritize by impact.** Three tiers:
   - **High impact** — affects user experience, data correctness, or security
   - **Medium impact** — affects code maintainability, readability, or developer experience
   - **Low impact** — cosmetic or minor improvements
   - **Risky** — changes that could break existing behavior (flag explicitly)

Do not skip this step. The `rationale` section in Step 2 must reference specific file paths and line numbers from this analysis.

## Step 2: Write the plan

The plan covers five sections. Be specific — reference actual file paths, function names, and library APIs from Step 1.

Use `todowrite` to publish the 5-section checklist at the start of Step 2. The user reads the checklist to follow progress. Mark each section done as you complete it:

```
- [ ] What
- [ ] How (optional)
- [ ] Order & Verify
- [ ] File changes
- [ ] Rationale
```

### What — what is being refined

Describe the refinement scope. Cover both the improvements and the risks.

Include:

- **Main improvements**: what will be better after refinement
- **Risks**: what could break, what needs careful handling

This section answers "what are we improving?" — not how, not when, not why.

### How — the structural approach (optional)

Describe the structural approach this refinement establishes. This is the abstraction that may be applied to other similar targets. Skip this section if the change is a one-off and no abstraction is being introduced.

Include:

- **What this pattern is**: the structural rule (e.g., "every X gets a Y component that follows Z convention")
- **Why this way**: what was considered, what was rejected, and the rationale — anchored in Step 1 evidence
- **Where it applies**: which parts of the codebase follow this pattern already (file paths, line numbers)
- **What it validates**: which assumption this refinement proves correct

The user must be able to read this section and say "yes, this is the right approach" or "no, adjust it" — before the plan is locked.

### Order & Verify — implementation sequence with per-slice verification

Plan the refinement as vertical slices, not horizontal layers. A slice is **where a human implementer would naturally draw a line** — not too small (1 concept alone), not too big (a full feature). The slice is a "working draft" that proves the approach, then you grow it.

**Granularity rule:** a slice is sized so that a human can finish it in one sitting and verify it works. It does not need to be production-ready. The next slice replaces or builds upon it.

**Draft-first principle:** prefer "improve something visible" over "complete it before testing". The slice proves the approach; later slices harden it.

**Slice patterns by concern — each starts as a draft, then grows:**

Code quality:

- Extract function — break a long function into smaller ones — verify: behavior unchanged
- Remove duplication — consolidate repeated logic — verify: behavior unchanged
- Simplify conditionals — flatten nested if/else — verify: behavior unchanged

Error handling:

- Replace throw with Result<T, E> — verify: errors returned, not thrown
- Add error boundary (UI layer only) — verify: errors surface to user
- Add validation — verify: invalid input handled
- Add retry logic (external I/O only) — verify: transient failures handled

Performance:

- Add memoization — verify: repeated calls cached
- Optimize re-renders — verify: unnecessary renders reduced
- Lazy load — verify: initial load faster

Testing:

- Add unit tests for existing function — verify: tests pass
- Add integration test — verify: end-to-end flow works
- Add edge case tests — verify: boundary conditions covered

Consistency:

- Align naming conventions — verify: no breaking changes
- Align file structure — verify: imports still work
- Align API patterns — verify: existing callers unaffected

**Bad (bundled) slice patterns — never do this:**

- ❌ "Refactor the entire module" (too broad — split into specific improvements)
- ❌ "Improve error handling everywhere" (horizontal layer — split by feature/area)
- ❌ "Add tests + refactor + optimize" (multiple concerns — one per slice)
- ❌ "Fix all the issues" (undefined scope — prioritize and sequence)

**Why this matters:** a slice that bundles multiple concerns is a horizontal layer in disguise. The result is the same as doing the whole refinement at once — you cannot verify incrementally. A draft-style slice lets you confirm the approach works before committing to detail.

List the slices in execution order. Each slice has its own verification — test pass (automated) and user app run (manual). The slice is not done until both parts pass. If a slice depends on another, the dependency is a `prerequisite:` note, not a reason to merge them.

For each slice, include:

- **What**: one-line description of the slice (a draft, not a complete feature)
- **Test**: test command (or `N/A` if skipped per Test policy)
- **App**: app command + what the user does + expected outcome

#### Test policy

- Run existing tests before and after each slice — verify no regressions
- Add tests only when the slice specifically targets test coverage

### File changes

List all files that will be created, modified, or deleted. Test files are already determined by the Test policy in Order — include them here without re-justifying.

| Path                   | type   | detail                         |
| ---------------------- | ------ | ------------------------------ |
| `path/to/existing.ts`  | Edit   | what changes                   |
| `path/to/file.test.ts` | Create | test: error paths + happy path |
| `path/to/old.ts`       | Delete | why it's removed               |

### Rationale

This section proves the plan was not written in a vacuum. Every claim traces back to a source.

| Question             | Source              | Evidence                           |
| -------------------- | ------------------- | ---------------------------------- |
| Why this approach    | Step 1 analysis     | specific file path + line numbers  |
| Why this scope       | issue: #N (if any)  | prior decision / discussion        |
| Why this structure   | existing codebase   | convention at `<path>:<line>`      |
| What was prioritized | Step 1 impact tiers | which areas ranked high/medium/low |

If a row in this table has no concrete evidence, the plan is not ready — return to Step 1.

## Step 3: display

MUST show the full plan in the chat as your next message. The execution gate verifies the assistant message. Format the result in Markdown:

```markdown
### What

[Refinement scope, main improvements + risks]

### How (optional)

[Structural approach]

### Order & Verify

**Slice 1: <one-line description>**

- Test: `<test command>` or `N/A` (per Test policy)
- App: `<app command>` → <what user does> → <expected outcome>

**Slice 2: <one-line description>**

- Test: ...
- App: ...

### File changes

| Path              | Type            | Detail       |
| ----------------- | --------------- | ------------ |
| `path/to/file.ts` | new/edit/delete | what changes |

### Rationale

[Why this plan, evidence from Step 1 analysis]
```

## Step 4: User agreement (REQUIRED)

The plan is not final until the user agrees. Use the `question` tool to surface a yes / edit / no decision on the full plan. The user may:

- **yes** — the plan is locked. Proceed to the next skill.
- **edit** — the user provides specific edits. If the change is structural, then ask again.
- **no** — the plan is rejected. Return to Step 1 or Step 2 with the user's feedback.

## Step 5: Write the plan to the issue body

After the user agrees (Step 4 = yes), the plan is locked. Write the slice list to the `# Refine Progress` section of the Refine issue body. The list is grouped by impact tier (High / Medium / Low / Risky) — the order in `Order & Verify` already follows this grouping, so re-apply the tier label as a checkbox prefix.

The body already contains the empty `# Refine Progress` section from the issue template. Use `gh issue edit` to populate the Slices checklist. Preserve all existing body content (Goal, Reference, What, Risks, Order, Verify) above the `# Refine Progress` section — only the Slices list is added here.

```bash
gh issue edit <refine_number> --body "$(cat <<'EOF'
... existing body content ...

# Refine Progress

## Slices (by impact tier)

- [ ] **High**: <Order & Verify の High slice を 1 行で>
- [ ] **High**: <...>
- [ ] **Medium**: <...>
- [ ] **Low**: <...>
- [ ] **Risky**: <...>

## Notes

EOF
)"
```

The Notes section is left empty here. The plan is locked.

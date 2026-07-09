# build

**These are the plans required prior to implementation. Need to create specific outputs.**

Plan that survives contact with the codebase. The building plan must reconcile them with what is actually in the repo, and the user must explicitly agree before the plan is locked.

## Tool usage policy

This skill uses a strict tool policy to keep the flow natural and the user in control:

- **`question` tool — Step 4 only.** Use it exactly once for the final consensus prompt. Do not use it to advance Step 1 or Step 2.
- **`todowrite` tool — Step 2 only.** Use it to publish the 5-section plan checklist. The user reads the checklist to follow progress.
- **`read` / `glob` / `grep` — Step 1 only.** Use them to reconcile research findings with the actual codebase. Not a free-for-all in later steps.
- **Chat text — natural dialogue.** Surface findings, ask clarifying questions, and present the final plan in chat.

## Step 1: Reconcile research with the codebase (REQUIRED)

This step exists because research findings can drift away from what the code actually does. A claim that is true in general can be wrong for _this_ project.

Do the following:

1. **Locate the relevant code** with `read` / `glob` / `grep`. Find the actual files, functions, and call sites that the plan will touch or rely on.
2. **Compare claim to code.** If a finding says "the library supports X", confirm that X is present in `node_modules/<lib>/` and used (or not used) in the project. If a finding says "Y is the convention", search the repo for instances of Y and Y's alternatives.
3. **Note the delta.** Three outcomes are possible:
   - **Code matches claim** — plan can adopt the pattern directly.
   - **Code contradicts claim** — the plan must either (a) change the code to match, or (b) keep the code and revise the plan's assumption. State which.
   - **Code is silent** — the claim cannot be evaluated from the code alone; flag it as a risk in the rationale.

Do not skip this step. The `rationale` section in Step 2 must reference specific file paths and line numbers from this comparison.

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

### What — what is being implemented

Describe the feature or change in scope. Cover both the main path and the error cases.

Include:

- **Main path**: what happens when everything works
- **Error cases**: how errors surface and what the user sees

This section answers "what are we building?" — not how, not when, not why.

### How — the structural approach (optional)

Describe the structural approach this plan establishes. This is the abstraction that may be applied to other similar targets. Skip this section if the change is a one-off and no abstraction is being introduced.

Include:

- **What this pattern is**: the structural rule (e.g., "every X gets a Y component that follows Z convention")
- **Why this way**: what was considered, what was rejected, and the rationale — anchored in Step 1 evidence
- **Where it applies**: which parts of the codebase follow this pattern already (file paths, line numbers)
- **What it validates**: which assumption this plan proves correct

The user must be able to read this section and say "yes, this is the right abstraction" or "no, adjust it" — before the plan is locked.

### Order & Verify — implementation sequence with per-slice verification

Plan the implementation as vertical slices, not horizontal layers. A slice is **where a human implementer would naturally draw a line** — not too small (1 concept alone), not too big (a full feature). The slice is a "working draft" that proves the approach, then you grow it.

**Granularity rule:** a slice is sized so that a human can finish it in one sitting and verify it works. It does not need to be production-ready. Hardcoded data, mocks, and placeholder UI are fine — the next slice replaces them with real implementations.

**Draft-first principle:** prefer "throw something up that works" over "complete it before testing". The slice proves the approach; later slices harden it.

**Slice patterns by concern — each starts as a draft, then grows:**

CRUD on a resource (e.g., a list of items):

- R only (read/display) — start with hardcoded data in UI, ignore CUD — verify: list renders
- C only (create) — add a form, save to local state — verify: new item appears
- U only (update) — add edit, update local state — verify: edit reflected
- D only (delete) — add delete, remove from state — verify: item disappears

Auth (sign-in flow):

- Sign-in draft — form + mock auth that always returns success + redirect — verify: sign in works
- Validation — add input format checks — verify: invalid input shows error
- Real API — replace mock with actual call — verify: real request fires
- Error handling — handle 401, 500 cases — verify: failure shows message
- Loading state — disable button during request — verify: button stays disabled

Web site (landing page):

- Hero section draft — placeholder headline + 1 CTA button — verify: button visible, clickable
- Features section — add 3 feature blocks — verify: blocks render
- Contact form — add form, submit shows success — verify: submission confirms
- Footer — minimal links + copyright — verify: footer visible

DB / data layer:

- 1 table + schema + a few seed rows + display in UI — verify: rows visible in app
- Real queries (R only) — replace seed with actual fetch — verify: real data loads
- Then C/U/D as separate slices — verify: each operation works

Real-time (incremental complexity):

- Polling draft — fetch every N seconds — verify: updates appear
- SSE — replace polling with Server-Sent Events — verify: real-time updates
- WebSocket — bidirectional channel — verify: both directions work
- Collaboration — multi-user state — verify: multiple users see each other

**Bad (bundled) slice patterns — never do this:**

- ❌ "Add X CRUD" (4 operations in one slice — split into R / C / U / D)
- ❌ "Build the X feature end-to-end" (everything at once — split into draft slices)
- ❌ "(data + UI + test) for X" (a horizontal layer in disguise)
- ❌ "Add X creation form with full validation, error handling, and success state" (too much for one slice)
- ❌ "Add all auth: sign-in + sign-up + password reset + OAuth" (multiple features in one slice)

**Why this matters:** a slice that bundles multiple concerns is a horizontal layer in disguise. The result is the same as doing the whole feature at once — you cannot verify incrementally. A draft-style slice lets you confirm the approach works before committing to detail.

List the slices in execution order. Each slice has its own verification — test pass (automated) and user app run (manual). The slice is not done until both parts pass. If a slice depends on another, the dependency is a `prerequisite:` note, not a reason to merge them.

For each slice, include:

- **What**: one-line description of the slice (a draft, not a complete feature)
- **Test**: test command (or `N/A` if skipped per Test policy)
- **App**: app command + what the user does + expected outcome

#### Test policy

Decide test necessity per slice, when defining the slice. This is part of the slicing decision, not a separate checklist applied later. Apply the rules below:

- **New functions / modules**: Required — error paths + happy path
- **Business logic / domain logic**: Required — all `Result<T, E>` error paths
- **API integrations**: Required — success + failure cases
- **Database (migrations, queries)**: Required — up/down migration + query result shape
- **State management (loaders, transitions)**: Required — transitions + edge cases (empty, loading, error)
- **CSS / styling**: Skip — not testable (visual verification only)
- **Configuration**: Skip — manual target-env verification
- **Trivial getters / mappings**: Skip — trivial code
- **External runtime dependency (plugins, etc.)**: Skip with reason — document why

When a slice needs a test, include the test file in the File changes table. Test files go in `[name].test.ts` colocated with the implementation.

### File changes

List all files that will be created, modified, or deleted. Test files are already determined by the Test policy in Order — include them here without re-justifying.

| Path                   | type   | detail                         |
| ---------------------- | ------ | ------------------------------ |
| `path/to/file.ts`      | New    | what this file does            |
| `path/to/file.test.ts` | New    | test: error paths + happy path |
| `path/to/existing.ts`  | Edit   | what changes                   |
| `path/to/old.ts`       | Delete | why it's removed               |

### Rationale

This section proves the plan was not written in a vacuum. Every claim traces back to a source.

| Question                  | Source                                    | Evidence                                    |
| ------------------------- | ----------------------------------------- | ------------------------------------------- |
| Why this approach         | research finding (Step 1 code comparison) | specific file path + line numbers           |
| Why this scope            | issue: #N (if any)                        | prior decision / discussion                 |
| Why this structure        | existing codebase                         | convention at `<path>:<line>`               |
| What delta was reconciled | Step 1 comparison                         | which claim matched / contradicted / silent |

If a row in this table has no concrete evidence, the plan is not ready — return to Step 1.

## Step 3: display

MUST show the full plan in the chat as your next message. The execution gate verifies the assistant message. Format the result in Markdown:

```markdown
### What

[Implementation scope, main path + error cases]

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

[Why this plan, evidence from feasibility + Step 1 codebase comparison]
```

## Step 4: User agreement (REQUIRED)

The plan is not final until the user agrees. Use the `question` tool to surface a yes / edit / no decision on the full plan. The user may:

- **yes** — the plan is locked. Proceed to the next skill.
- **edit** — the user provides specific edits. If the change is structural, then ask again.
- **no** — the plan is rejected. Return to Step 1 or Step 2 with the user's feedback.

## Step 5: Write the plan to the issue body

After the user agrees (Step 4 = yes), the plan is locked. Write the slice list to the `# Build Progress` section of the Build issue body. This makes the plan durable across sessions — the next session reads the body and resumes from the last completed stage.

The body already contains the empty `# Build Progress` section from the issue template. Use `gh issue edit` to populate the Stages checklist. Preserve all existing body content (Goal, Reference, What, How, Order, Verify) above the `# Build Progress` section — only the Stages list is added here.

```bash
gh issue edit <build_number> --body "$(cat <<'EOF'
... existing body content ...

# Build Progress

## Stages

- [ ] Stage 1: <Order & Verify の slice 1 を 1 行で>
- [ ] Stage 2: <Order & Verify の slice 2 を 1 行で>
- [ ] Stage 3: <...>

## Notes

EOF
  )"
```

The Notes section is left empty here. Subsequent `[run]` invocations update the body with stage check-offs (`[x]`) and Notes entries — that is the run command's responsibility, not prepare's.

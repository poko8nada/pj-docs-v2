# refine — plan

Produce a refinement plan grounded in the existing codebase. User **yes** locks the plan in this workflow only (chat agreement). Persisting to an issue is the caller’s job.

## Step 1 — Analyze existing code

Refinement must target real issues in _this_ repo — not hypothetical cleanups.

1. Locate relevant files, functions, and call sites (`Read` / `Glob` / `Grep`).
2. Identify concrete improvement areas (duplication, complexity, missing errors, perf, inconsistent patterns, missing tests, outdated patterns — only what the code shows).
3. Prioritize with impact tiers (every item gets one):
   - **High** — user experience, data correctness, or security
   - **Medium** — maintainability / readability / developer experience
   - **Low** — cosmetic or minor
   - **Risky** — could break existing behavior (flag explicitly; sequence with care)

Rationale must cite concrete paths (and line numbers when useful). Do not skip this step.

## Step 2 — Write the plan

Five sections. Be specific — real paths, APIs, and names from Step 1. Progress in chat is fine.

| Section            | Owns                                  | Does not own                   |
| ------------------ | ------------------------------------- | ------------------------------ |
| **What**           | Improvements in scope + risks         | Sequence, file list            |
| **How** (optional) | Structural approach / abstraction     | Slice order, step-by-step work |
| **Order & Verify** | Slice sequence + how each is verified | Scope narrative (that is What) |
| **File changes**   | Paths touched                         | Why (that is Rationale)        |
| **Rationale**      | Evidence for claims                   | The plan body itself           |

Skip **How** for one-offs. If present: pattern, why this way (rejected alternatives), where it already exists, what it validates — still no slice list.

### Order & Verify

**Two separate rules — do not collapse them:**

1. **Capability order (thin improvements)**  
   One sitting, user-verifiable, one concern. Prefer High → Medium → Low; place **Risky** where blast radius is understood (often after a safer proof slice, or alone with explicit verify).  
   “Draft” means _smaller change surface_, not _sloppy behavior_. Prefer prove-then-grow over “finish the whole refactor before checking”.

2. **Behavior and data fidelity**  
   Unless the slice’s stated goal is a visible behavior change, **preserve existing behavior**.  
   If the slice touches UI or seeded/displayed data, that data must stay **production-representative** (realistic values and edge cases). Do not introduce throwaway placeholders (`foo`, `test`, `lorem`) while “just refactoring”.

**Illustrative capability orders** (teach _thin growth_; not a checklist; do not force-fit):

- Code quality: extract one function → remove one duplication cluster → simplify one conditional nest
- Errors: tighten one boundary → add validation for one input path → retry only for one external I/O
- Performance: memoize one hotspot → fix one re-render path → lazy-load one heavy route
- Testing: cover one existing function → one integration path → edge cases for that path
- Consistency: naming in one area → file layout in one area → API pattern for one caller set

**Avoid bundling:** “refactor the whole module”; “improve error handling everywhere”; “tests + refactor + optimize”; “fix all the issues”.

For each slice, in order:

- **What** — one line (which improvement this adds) + tier label (`High` / `Medium` / `Low` / `Risky`)
- **Test** — command, or `N/A` per Test policy
- **App** — run app → user action → expected result (including “unchanged” when that is the goal)

Dependencies: `prerequisite:` notes — not a reason to merge slices.

#### Test policy (decide per slice when slicing)

- Run **existing** tests before and after each slice — no regressions
- Add tests when the slice’s goal is coverage, or when changing risky behavior without adequate cover
- Follow **this repository’s** test layout and naming

List needed test files under File changes.

### File changes

| Path                  | type                | detail       |
| --------------------- | ------------------- | ------------ |
| `path/to/existing.ts` | Edit / Delete / New | what changes |

### Rationale

| Question             | Source                       | Evidence                    |
| -------------------- | ---------------------------- | --------------------------- |
| Why this approach    | Step 1 analysis              | path (lines)                |
| Why this scope       | prior decisions / discussion | concrete reference          |
| Why this structure   | codebase convention          | path (lines)                |
| What was prioritized | Step 1 impact tiers          | high / medium / low / risky |

Empty evidence → return to Step 1.

## Step 3 — Display

Paste the Step 2 plan in chat in this shape — same content, no rewrite:

```markdown
### What

...

### How (optional)

...

### Order & Verify

**Slice 1: ...** (High|Medium|Low|Risky)

- Test: `...` or `N/A`
- App: `...` → user does ... → expect ...

### File changes

| Path | Type | Detail |
| ---- | ---- | ------ |

### Rationale

...
```

## Step 4 — User agreement

Clear yes / edit / no. Grounded discussion, not an empty prompt.

- **yes** — locked in this workflow; return to caller
- **edit** — apply; re-show if structural; agree again
- **no** — back to Step 1 or 2 with reasons

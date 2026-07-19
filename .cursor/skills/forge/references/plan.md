# forge — plan

Produce a plan that survives contact with the codebase. User **yes** locks the plan in this workflow only (chat agreement). Persisting to an issue is the caller’s job.

## Step 1 — Reconcile with the codebase

General knowledge and prior research drift from _this_ repo. Reconcile before writing the plan.

1. Locate relevant files, functions, and call sites (`Read` / `Glob` / `Grep`).
2. Compare each important claim to the code (library support, conventions, existing patterns).
3. Record the delta:
   - **Matches** — plan may adopt it
   - **Contradicts** — either change code to match, or keep code and revise the plan (state which)
   - **Silent** — cannot verify from code; call out in Rationale

Rationale must cite concrete paths (and line numbers when useful). Do not skip this step.

## Step 2 — Write the plan

Five sections. Be specific — real paths, APIs, and names from Step 1. Progress in chat is fine.

| Section            | Owns                                  | Does not own                   |
| ------------------ | ------------------------------------- | ------------------------------ |
| **What**           | Scope, main path, error cases         | Sequence, file list            |
| **How** (optional) | Structural approach / abstraction     | Slice order, step-by-step work |
| **Order & Verify** | Slice sequence + how each is verified | Scope narrative (that is What) |
| **File changes**   | Paths touched                         | Why (that is Rationale)        |
| **Rationale**      | Evidence for claims                   | The plan body itself           |

Skip **How** for one-offs. If present: pattern, why this way (rejected alternatives), where it already exists, what it validates — still no slice list.

### Order & Verify

Do not invent slices from nothing. Same idea as Design (Default matrix → then build order):

1. **Inventory** — from Spec + Design `# Screen` (Default / All) + Step 1 reconcile, list the capabilities in scope (chat is fine; short bullets).
2. **Slice order** — only then sequence those items into vertical slices.

**Two separate rules — do not collapse them:**

1. **Capability order (how humans learn by building)**  
   Grow _behavior_ in thin vertical slices. A slice is one sitting, user-verifiable, one concern (e.g. R before C before U before D). Incomplete _features_ are expected early; incomplete _quality of data_ is not.

2. **Data fidelity**  
   Data shown or seeded in every slice must be **production-representative**: realistic values and edge cases (long/short strings, empty, mixed status, special characters — whatever the domain needs).  
   Do **not** use throwaway placeholders (`foo`, `test`, `lorem`, empty shells) just because the slice is early.  
   “Draft” means _fewer capabilities_, not _fake-looking data_.

Stubs for **external systems** (e.g. auth provider always returns success) can wait for a later slice — that is infrastructure sequencing, not an excuse for junk domain data in the UI.

**Illustrative capability orders** (teach the _growth order_; not a checklist; do not force-fit):

- CRUD: display with real-shaped records (R) → create → update → delete
- Auth: sign-in path with stubbed provider → validation → real provider → errors → loading
- Landing: hero → features → form → footer (each with real copy/content, not filler)
- Data: schema + representative seed + display → live reads → then C/U/D
- Realtime: poll → SSE → WebSocket → multi-user

**Avoid bundling:** full CRUD in one slice; end-to-end feature; data+UI+tests as one horizontal cut; sign-in+sign-up+OAuth together; one slice that is “form + full validation + errors + success”.

For each slice, in order:

- **What** — one line (which _capability_ this adds)
- **Test** — command, or `N/A` per Test policy
- **App** — run app → user action → expected result

Dependencies: `prerequisite:` notes — not a reason to merge slices.

#### Test policy (decide per slice when slicing)

Required: new modules, domain logic, API integrations, DB migrations/queries, state transitions (include edge cases).  
Skip: CSS/visual-only, config (manual env check), trivial getters/mappings, external plugins (skip with reason).

List needed test files under File changes. Follow **this repository’s** test layout and naming.

### File changes

| Path              | type                | detail       |
| ----------------- | ------------------- | ------------ |
| `path/to/file.ts` | New / Edit / Delete | what changes |

### Rationale

| Question            | Source                           | Evidence                    |
| ------------------- | -------------------------------- | --------------------------- |
| Why this approach   | Step 1 (+ prior research if any) | path (lines)                |
| Why this scope      | prior decisions / discussion     | concrete reference          |
| Why this structure  | codebase convention              | path (lines)                |
| What was reconciled | Step 1 delta                     | match / contradict / silent |

Empty evidence → return to Step 1.

## Step 3 — Display

Paste the Step 2 plan in chat in this shape — same content, no rewrite:

```markdown
### What

...

### How (optional)

...

### Order & Verify

**Slice 1: ...**

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

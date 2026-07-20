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

**Avoid bundling:** full CRUD in one slice; end-to-end feature; a horizontal “tests-only” cut after all features; sign-in+sign-up+OAuth together; one slice that is “form + full validation + errors + success”.  
**Do** put **New logic + its New unit tests** in the same vertical slice (not a later tests-only slice).

For each slice, in order:

- **What** — one line (which _capability_ this adds)
- **Test** — command, or `N/A` per Test policy; when Required, name which error/edge angles you cover (short list)
- **App** — run app → user action → expected result (human / browser check — stands in for e2e)

Dependencies: `prerequisite:` notes — not a reason to merge slices.

#### Test policy (decide per slice when slicing)

**Stance:** Prefer solid TypeScript / schema at boundaries plus **unit tests on pure logic error paths**. Skip browser automation and component render tests by default — App / cmux covers the main path for small–medium products.

**Required**

- New or changed **domain / pure logic** (parsers, transitions, calculations, `Result` mapping) — include **error paths and edges**, not only the happy path
- When File changes adds a New logic module, also list a colocated New `*.test.ts` / `*.test.tsx` (same feature folder — see `rules` → `shared`). Do not defer those tests to a later horizontal slice
- Prefer testing **mappers / error mapping as pure functions**. Do not require thin tests that only mock `fetch` / I/O; keep I/O at the edge
- Complex client transitions: extract the decision logic to a pure function and unit-test that; do not require React Testing Library on the hook itself

**Pick angles that apply** (skip with N/A if the capability has no such case — do not force-fit every row):

| Angle           | Examples                                                |
| --------------- | ------------------------------------------------------- |
| Invalid         | malformed input, wrong meaning under a plausible type   |
| Absent          | `undefined`, empty string/array, missing required field |
| Boundary        | 0 / 1 / max±1, min/max numbers                          |
| Excess          | too long, too many items, deep nesting                  |
| Duplicate       | same id / key / email twice                             |
| Double submit   | second click, replayed command                          |
| Race / order    | stale update wins, responses arrive out of order        |
| Bad transition  | illegal state move (e.g. finished → start again)        |
| Authz           | signed out, other user's resource, missing role         |
| Idempotent      | delete again, act on already-absent                     |
| Transient fail  | timeout, 5xx, retry then give up                        |
| Permanent fail  | 4xx, rejected, missing remote                           |
| Partial success | one side wrote, the other did not                       |
| Empty success   | OK with empty body / zero hits                          |

**Skip** (note a one-word reason on the slice when relevant)

- CSS / visual-only
- Playwright / e2e / browser automation
- Component render / click-heavy UI tests (use **App** instead)
- Config-only (manual env check)
- Trivial getters / thin pass-through mappings
- External plugin internals (stub at the boundary; test your mapping if any)

List needed test files under File changes. Follow **this repository’s** layout and naming (`rules` → `shared` colocation).

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

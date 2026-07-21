# work — Build

Use when this `/work` session advances an open **`[Build]`** (Roadmap / Test strategy / Deploy + product code). Soft skills are still normal (`inventory`, `data-model` Full, `grain`, `foundation` continuation, `feasibility` on a Build choice) — same rail as Goal/Discover; the difference is what the outcome ties to.

Goal/Discover-only sessions → `goal-discover.md`.

## Inventory sources

- `[Build]` axes (Roadmap / Test strategy / Deploy) + Links to Goal / Discover
- Soft comments on Build (and Discover when relevant) + `findings/`
- **Product tree / relevant code** — axes alone are not enough
- Session scope agreed in discussion

List in-scope capabilities or improvements in chat, then slice. Do not slice from an empty list. No durable Plan section on the Build issue — session slices stay in chat.

## What this situation often does

- Implement / fix / refactor product code for one vertical concern
- Run softs when Build needs concrete input → `findings/` → soft comment on Build (edit in place)
- Update Build axes when judgment changes (overview + why + agreed)
- Verify per slice (Test + App below)

Prefer cheap media only when the slice is explicitly exploratory; do not “try in the product tree and throw away.” Harness / meta → `/chore`.

## Slice shape (examples — teach growth order; do not force-fit)

- CRUD: display with real-shaped records (R) → create → update → delete
- Auth: sign-in with stubbed provider → validation → real provider → errors → loading
- Landing: hero → features → form → footer (real copy, not filler)
- Data: data-model Full → schema + representative seed + display → live reads → then C/U/D
- Inventory: inventory soft (full file tree) → then code slices from that list
- Soft-on-Build: one soft pass → findings → soft comment; code adoption in a later slice if needed
- Refine-like: extract one function → remove one duplication cluster — not “refactor the module”

**Avoid bundling:** full CRUD; whole auth feature; form + full validation + errors + success; horizontal “tests-only” after all features.

**Do** put **New logic + its New unit tests in the same vertical slice.**

For each slice, in chat:

- **What** — one line (which capability / fix this adds)
- **Test** — command, or `N/A` per Test policy; when Required, name error/edge angles (short)
- **App** — run app → user action → expected result (human / browser — stands in for e2e)

Dependencies: `prerequisite:` notes — not a reason to merge slices.

## Test policy (decide per slice when slicing)

Align with Build **Test strategy** (what MVP/Next guarantees). If a slice’s tests would contradict the axis, update the axis first (or name `/discussion`).

**Stance:** Prefer solid TypeScript / schema at boundaries plus **unit tests on pure logic error paths**. Skip browser automation and component render tests by default — App / cmux covers the main path for small–medium products.

**Required**

- New or changed **domain / pure logic** (parsers, transitions, calculations, `Result` mapping) — include **error paths and edges**, not only the happy path
- When the slice adds a New logic module, also add a colocated New `*.test.ts` / `*.test.tsx` (same feature folder — see `rules` → `shared`). Do not defer those tests to a later horizontal slice
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
| Bad transition  | illegal state move                                      |
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

Follow this repository’s test layout and naming (`rules` → `shared` colocation). When tests apply, run `pnpm test:run` after the slice (see `rules`).

## After a slice

Commit when agreed (per slice or batched). Update Build (or soft comments) at milestones — not after every slice by default. Browser check via `cmux-browser` when App verification needs it. If direction stalls, name `/discussion`.

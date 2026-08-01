# agenda — Build

Use when this `/work` session advances an open **`[Build]`** (Roadmap / Test strategy / Deploy + product code). Soft skills are still normal (`inventory`, `data-model` Full, `grain`, `foundation` continuation, `feasibility` on a Build choice).

Goal/Discover-only sessions → `goal-discover.md`.

Slice table and fills → parent `agenda/SKILL.md`.

## Inventory sources

- `[Build]` axes (Roadmap / Test strategy / Deploy) + Links to Goal / Discover
- Soft comments on Build (and Discover when relevant) + `findings/`
- **Product tree / relevant code** — axes alone are not enough
- Session scope agreed in discussion

## What this situation often does

- Implement / fix / refactor product code for one vertical concern
- Run softs when Build needs concrete input → `findings/` → soft comment on Build (edit in place)
- Update Build axes when judgment changes (overview + why + agreed)
- Verify per slice (Test + Surface from `agenda/SKILL.md` Build fills, plus below)

Prefer cheap media only when the slice is explicitly exploratory. Harness / meta → `/chore`.

## Surface examples

- Web UI — dev server → user action → expected UI (browser / cmux)
- HTTP API — method + path → status + body (curl, client, playground)
- CLI — command + args → stdout / exit code
- Library — minimal consumer example runs as documented

## Test policy

Align with Build **Test strategy** (what MVP/Next guarantees). If a slice’s tests would contradict the axis, update the axis first (or name `/discussion`).

**Stance:** Prefer solid TypeScript / schema at boundaries plus **unit tests on pure logic error paths**. Skip browser automation and component render tests by default — **Surface** covers the main path for small–medium products.

**Required**

- New or changed **domain / pure logic** — include **error paths and edges**, not only the happy path
- New logic module → colocated New `*.test.ts` / `*.test.tsx` in the same feature folder (`rules` → `conventions`)
- Prefer testing mappers / error mapping as pure functions; keep I/O at the edge
- Complex client transitions: extract decision logic to a pure function and unit-test that

**Pick angles that apply** (skip with N/A when the capability has no such case):

| Angle           | Examples                                              |
| --------------- | ----------------------------------------------------- |
| Invalid         | malformed input; wrong meaning under a plausible type |
| Absent          | `undefined`, empty, missing required field            |
| Boundary        | 0 / 1 / max±1, min/max numbers                        |
| Excess          | too long, too many items, deep nesting                |
| Duplicate       | same id / key / email twice                           |
| Double submit   | second click, replayed command                        |
| Race / order    | stale update wins; out-of-order responses             |
| Bad transition  | illegal state move                                    |
| Authz           | signed out; other user’s resource; missing role       |
| Idempotent      | delete again; act on already-absent                   |
| Transient fail  | timeout, 5xx, retry then give up                      |
| Permanent fail  | 4xx, rejected, missing remote                         |
| Partial success | one side wrote, the other did not                     |
| Empty success   | OK with empty body / zero hits                        |

**Skip** (one-word reason on the slice when relevant)

- CSS / visual-only
- Playwright / e2e / browser automation
- Component render / click-heavy UI tests (use **Surface** instead)
- Config-only (manual env check)
- Trivial getters / thin pass-through mappings
- External plugin internals (stub at the boundary; test your mapping if any)

When tests apply, run `pnpm test:run` after the slice (`rules`).

## After a slice

Commit when agreed (per slice or batched). Update Build (or soft comments) at milestones — not after every slice by default. Browser check via `cmux-browser` when Surface needs it. If direction stalls, name `/discussion`.

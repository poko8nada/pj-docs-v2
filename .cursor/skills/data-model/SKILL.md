---
name: data-model
description: >-
  Soft skill: lock product data as types (complete fields in scope) plus representative samples that always include edge cases.
  Use from /work when Discover needs production-shaped data for discussion or look materials (scoped subset), or when Build needs the full product data set before schema/seed/CRUD.
  Soft — not a hard gate. Writes findings/data-model/ and returns Topic / Path / Why / Summary / Axes touched to the caller.
---

# data-model

Lock **what information the product carries**: types (fields) and **representative samples**. Samples always include edge cases. Where the data lives (hardcoded, fixture, API, store) is a one-line note at most — not this skill’s design job.

Soft skill — nothing hard-denies if skipped. Write concrete output under `findings/data-model/` (create that directory on first write if missing). Return a short handoff block to the caller. Do **not** create or edit GitHub issues from here.

## How the caller slices this skill

Each **Step** below is one verifiable unit. Agree and finish a Step before the next. Do not merge later Steps into one silent pass unless the user explicitly allows a short path.

## Scope (pick on entry)

Agree one:

- **Narrow** — Only entities needed for the current Discover discussion or look materials. Production-representative for that subset — not a product-wide catalog.
- **Full** — Every entity the product handles for this Build / MVP. Field lists are **complete** for each entity.

Both scopes: samples are production-shaped and **must include edges**.

**Done when (On entry):** User agrees Narrow vs Full and the boundary. Stop if slicing.

## What you own

- Scope boundary (Narrow vs Full)
- Types in scope: entities, ownership / aggregates, **complete field lists** for those entities
- Representative samples with required edge coverage
- Optional one-line **Current home** (hardcoded / fixture / API / store)
- Writing confirmed output under `findings/data-model/` (append-only)
- Handoff fields for the caller

## What you do not own

- Whether this session should run — the caller decides
- GitHub issue bodies or comments
- Transport or storage design (endpoints, ORM, DB choice)
- Look / HTML workshop edits
- File / module path inventories
- Product code outside `findings/data-model/`

## Steps

### Step 1 — Lock scope

Confirm Narrow or Full and name what is in / out (e.g. “hero + pricing cards only” vs “MVP entities”).

**Done when:** Boundary agreed. Stop if slicing.

### Step 2 — Draft types

For each in-scope entity:

- Name and ownership (what must stay consistent together)
- **Complete** field list for that entity (name, meaning, presence — required / optional / absent-as-undefined)
- Relations to other in-scope entities when needed

Show in chat. **yes** / **edit** / **no**.

**Done when:** Types agreed. Stop if slicing.

### Step 3 — Draft samples (edges required)

For each entity, provide representative records. **Always** include edges that matter for this domain. Pick what applies; do not force every angle:

- Long / short strings
- Missing optional fields
- Empty lists / zero counts
- Mixed statuses
- Special characters
- Boundary numbers (0, 1, max±1) when numeric fields exist

Happy-path-only sample sets are not done.

Show in chat. **yes** / **edit** / **no**.

**Done when:** Samples agreed (edges present). Stop if slicing.

### Step 4 — Persist and hand off

On **yes**: ensure `findings/data-model/` exists, write `findings/data-model/<dated-slug>.md`, return handoff.

**Done when:** Findings file written and handoff returned.

## Output shape (findings MD)

```markdown
## Scope

Narrow | Full — …
Current home: … # optional one line

## Types

### <Entity>

- Ownership: …
- Fields:
  - `id` — … (required)
  - `title` — … (required)
  - `status` — … (required)
  - `note` — … (optional)

## Samples

### <Entity>

- Typical: `{ ... }`
- Edges: `{ ... }` # one or more records; edges required
```

Prefer nested bullets over wide tables. Keep sample JSON compact (inline or short fenced blocks in the real file).

## Handoff (return to caller)

```markdown
- Topic: …
- Path: findings/data-model/<dated-slug>.md
- Why:
  - …
- Summary: … # optional; at most 3 lines
- Axes touched: … # optional
```

## Anti-patterns

- Full presented as Narrow (or the reverse) without saying so
- “Main fields only” for an entity that is in scope — fields must be complete for that entity
- Samples without edges
- Designing APIs, schemas-as-DB-DDL, or library choice here
- Editing GitHub issues from this skill
- Overwriting prior `findings/data-model/` files without user request
- Skipping `findings/data-model/` create on first write
- Running later Steps without prior Step agreement when the caller expects sliced Steps

## Close

Done after Step 4. Earlier Steps are complete only for that Step’s Done when.

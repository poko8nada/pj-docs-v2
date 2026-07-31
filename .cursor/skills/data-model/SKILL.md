---
name: data-model
description: >-
  Soft skill: lock product data as complete-in-scope types plus samples with edges; write findings/data-model/.
  Use for Discover (Narrow) or Build (Full) before schema/seed/CRUD.
---

# data-model

Types + representative samples (edges required). Append-only. No GitHub issues. Not API/ORM/DB design.

Each Step is one unit unless user allows a short path.

## Steps

0. **Pick scope** — Narrow (current Discover/look subset) or Full (every MVP entity). Both need edge samples.
1. **Lock scope** — name in/out boundary.
2. **Draft types** — per entity: ownership + complete fields. yes/edit/no.
3. **Draft samples** — typical + edges (missing optional, empty lists, boundaries, …). Happy-path-only = not done. yes/edit/no.
4. **Persist** — on yes, write `findings/data-model/<dated-slug>.md` + handoff.

## Format

```markdown
## Scope

Narrow | Full — …
Current home: … # optional one line

## Types

### <Entity>

- Ownership: …
- Fields: …

## Samples

### <Entity>

- Typical: { … }
- Edges: { … }
```

Handoff: Topic / Path / Why / Summary / Axes touched.

## Limits

- Complete fields for every in-scope entity.
- No transport/storage design here.
- Do not overwrite prior findings without user ask.
- Do not edit issues or product code outside findings.

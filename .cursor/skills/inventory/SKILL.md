---
name: inventory
description: >-
  Builds a complete New / Edit / Delete file and module inventory for a Build so implementation has an explicit surface. Use when the whole Build/MVP tree must be reconciled before coding. Do not use for a single slice, session planning, or a task agenda; write the inventory to findings/inventory/.
---

# inventory

Whole-Build path list (New/Edit/Delete), grouped by feature folder. Append-only. No GitHub issues.

Placement rules → `references/placement.md`. Each Step is one unit unless user allows a short path.

## Steps

1. **Lock scope** — agree which Build/MVP this full inventory covers and what is out.
2. **Reconcile** — Glob/Grep/Read existing tree; short match/contradict/silent notes. No full path list yet.
3. **Draft** — every path for the agreed Build per `references/placement.md`. Show in chat → yes/edit/no.
4. **Persist** — on yes, write `findings/inventory/<dated-slug>.md` + handoff.

## Format

```markdown
## Scope

## Reconcile

## Inventory

### <feature-folder>

- `path` — New|Edit|Delete — role
```

No slice-order section. Handoff: Topic / Path / Why / Summary / Axes touched.

## Limits

- Not a session fragment presented as the Build inventory.
- Do not invent deep trees silently — ask.
- Do not overwrite prior findings without user ask.
- Do not edit issues or product code outside findings.

# Forge Template

Use this template for the Forge issue body. Reference the Spec and Design issue bodies (and material comments) when creating. 1 Forge issue is open at a time during the forge phase.

Create thin (empty Plan sections). The `forge` skill + `references/plan.md` produce the plan; the `issue` skill persists it after user **yes**.

```markdown
<!-- FOR AGENT — do not edit. Operating instructions. -->

## For Agent: Operating Instructions

### Principles

- Forge turns Spec + Design into working product. The deliverable is the code; the body holds the Plan.
- Plan shape: What / How (optional) / Order & Verify / File changes / Rationale — how to write it is `.cursor/skills/forge/references/plan.md`. Do not invent a different structure here.
- Mode ①: inventory capabilities from Spec + Design `# Screen` (Default / All), then slice order — do not slice from an empty list.
- Slices are vertical capabilities (one sitting, verifiable). Capability order and data fidelity are separate rules — see plan.md.
- Persist issue updates at **milestones** (Mode ① lock, session end, close) — not after every slice. Chat agreement stays per slice.
- Design issue `# Screen` is the source for component structure, Props, and TODOs. `# Grain` and `# Tokens` set visual direction. Read the Design issue before locking or implementing.
- When UI drifts from `# Grain` / `# Tokens`, or interactivity lands, the forge phase may invoke `grain` (Audit / Improve). Fold returned briefs into the next slice.

### Success Criteria

- All Plan sections are concrete: file paths, function names, library APIs from codebase reconciliation.
- Slices split by concern, each with Test + App verification. Test policy decided per slice.
- User has approved the plan in chat before any product code is written.

### Common Failure Modes

- Bundled slices ("Add X CRUD", "ship the whole auth feature"). Grow capability by capability.
- Slicing before an inventory from Spec / Design Screen.
- Throwaway placeholder data in early slices — data must stay production-representative; “draft” means fewer capabilities, not fake-looking data.
- Commenting / editing the issue after every slice agreement.
- Ad-hoc tests or no Test policy decision per slice.
- Treating user agreement as implied.

<!-- FOR AGENT — do not edit. Operating instructions. -->

---

## Reference

- Spec: #<spec_number>
- Design: #<design_number>
- Design outputs: <summary of design deliverables>
- Codebase: <relevant files/patterns identified>

---

# Plan

## What

## How

## Order & Verify

- [ ] **Slice 1: <one-line description>**
  - Test: `<test command>` or `N/A` (per Test policy)
  - App: `<app command>` → <what user does> → <expected outcome>

- [ ] **Slice 2: <one-line description>**
  - Test:
  - App:

## File changes

| Path              | Type            | Detail       |
| ----------------- | --------------- | ------------ |
| `path/to/file.ts` | new/edit/delete | what changes |

## Rationale

## Notes
```

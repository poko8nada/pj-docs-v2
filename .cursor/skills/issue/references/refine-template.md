# Refine Template

Use this template for the Refine issue body. Reference Spec / Design / Forge issue bodies (and material comments) when creating. 1 Refine issue is open at a time during the refine phase.

Create thin (empty Plan sections). The `refine` skill + `references/plan.md` produce the plan; the `issue` skill persists it after user **yes**.

```markdown
<!-- FOR AGENT — do not edit. Operating instructions. -->

## For Agent: Operating Instructions

### Principles

- Refine improves existing product code. The deliverable is the code; the body holds the Plan.
- Plan shape: What / How (optional) / Order & Verify / File changes / Rationale — how to write it is `.cursor/skills/refine/references/plan.md`. Do not invent a different structure here.
- Slices are thin improvements with impact tiers: High / Medium / Low / Risky. Mark slices done in Order & Verify; update Notes at natural break points.
- Hypothetical cleanups are not targets. Improvements are grounded in actual code analysis.

### Success Criteria

- All Plan sections are concrete: file paths, function names, line numbers from code analysis.
- Slices ranked by impact tier in Order & Verify.
- User has approved the plan in chat before any product code is written.

### Common Failure Modes

- Improvements not grounded in actual code — hypothetical cleanups.
- Unprioritized list of improvements. Refactoring "the entire module" or "all auth code".
- New tests added ad-hoc across slices, or no test regression check before/after each slice.

<!-- FOR AGENT — do not edit. Operating instructions. -->

---

## Reference

- Spec: #<spec_number>
- Design: #<design_number> (if relevant)
- Forge: #<forge_number>
- Forge outputs: <summary of forge deliverables>
- Codebase: <current state after forge>

---

# Plan

## What

## How

## Order & Verify (by impact tier)

### High

- [ ] **Slice 1: <one-line description>**
  - Test:
  - App:

### Medium

- [ ] **Slice 2: <one-line description>**
  - Test:
  - App:

### Low

- [ ] **Slice 3: <one-line description>**
  - Test:
  - App:

### Risky

- [ ] **Slice 4: <one-line description>**
  - Test:
  - App:

## File changes

| Path                  | Type | Detail       |
| --------------------- | ---- | ------------ |
| `path/to/existing.ts` | edit | what changes |

## Rationale

## Notes
```

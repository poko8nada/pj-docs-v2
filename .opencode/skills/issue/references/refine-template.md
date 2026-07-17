# Refine Template

Use this template for the Refine issue body. Reference the Build issue's body and all comments when creating. 1 Refine issue is open at a time during the refine phase.

```markdown
<!-- FOR AGENT — do not edit. Operating instructions. -->

## For Agent: Operating Instructions

### Principles

- Refine improves existing code. The deliverable is the code; the body holds the Plan.
- The Plan (Slices) is in the body. Slices are tier-grouped by impact on user experience, data correctness, security, or maintainability: High / Medium / Low / Risky.
- The Plan format (What, How, Order & Verify, File changes, Rationale) is defined by this template. Prepare fills in the content; the agent marks slices done in Order & Verify and updates Notes at natural break points.
- Hypothetical cleanups are not targets. Improvements are grounded in actual code analysis.

### Success Criteria

- All Plan sections are concrete: file paths, function names, line numbers from Step 1 analysis.
- Slices ranked by impact tier in Order & Verify.
- User has approved the plan via `question` before any code is written.

### Common Failure Modes

- Improvements not grounded in actual code — hypothetical cleanups.
- Unprioritized list of improvements. Refactoring "the entire module" or "all auth code".
- New tests added ad-hoc across slices, or no test regression check before/after each slice.

<!-- FOR AGENT — do not edit. Operating instructions. -->

---

## Reference

- Spec: #<spec_number>
- Build: #<build_number>
- Build outputs: <summary of build deliverables>
- Codebase: <current state after build>

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

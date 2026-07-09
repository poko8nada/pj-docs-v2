# Build Template

Use this template for the Build issue body. Reference the Design issue's body and all comments when creating. 1 Build issue is open at a time during the build phase.

```markdown
<!-- FOR AGENT — do not edit. Operating instructions. -->

## For Agent: Operating Instructions

### Principles

- Build turns a Design into working code. The deliverable is the code; the body holds the Plan.
- The Plan (Slices) is in the body. Slices are vertical, draft-first: one slice per concern (R / C / U / D, draft → harden), each verifiable in one sitting. Bundled slices are forbidden.
- The Plan format (What, How, Order & Verify, File changes, Rationale) is defined by this template. Prepare fills in the content; the agent marks slices done in Order & Verify and updates Notes at natural break points.
- The Design Spec is the source for component structure, Props, and TODOs. Fetch with `gh issue view <design_number> --json body | jq -r '.body'`.

### Success Criteria

- All Plan sections are concrete: file paths, function names, library APIs from Step 1 reconciliation.
- Slices split by concern, each with Test + App verification. Test policy decided per slice.
- User has approved the plan via `question` before any code is written.

### Common Failure Modes

- Bundled slices ("Add X CRUD", "Build the auth feature"). Draft-first, grow slice by slice.
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

| Path | Type | Detail |
| --- | --- | --- |
| `path/to/file.ts` | new/edit/delete | what changes |

## Rationale

## Notes
```

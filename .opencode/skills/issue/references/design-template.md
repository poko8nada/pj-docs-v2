# Design Template

Use this template for the Design issue body. Reference the Spec's body and all comments when creating.

```markdown
<!-- FOR AGENT — do not edit. Operating instructions. -->

## For Agent: Operating Instructions

### Principles

- Design aligns on visual and structural direction through a default screen — a thinking surface, not a prototype.
- Components are written production-ready from the start. Hardcoded data only: no event handlers, no state, no fetched data.
- The real deliverable is the spec (`_design-spec.md`: Style Guide + Component Matrix), not the screen.
- `prototype/` is disposable. Significant changes during build → delete it and re-run Design.

### Success Criteria

- Default screen renders with realistic data and visible edge cases.
- Every component has a structured comment block (state, Props, TODO).
- `prototype/_design-spec.md` exists with Style Guide and Component Matrix.
- User has confirmed the screen in the browser before Design closes.

### Common Failure Modes

- Treating `prototype/` as the product. Writing components in a one-off style instead of production location.
- Skipping the Component Matrix, or leaving component comments vague.
- Building more than one screen. Adding interactivity, state, or fetched data.
- Accumulating `prototype/` versions instead of regenerating it whole.

<!-- FOR AGENT — do not edit. Operating instructions. -->

---

## Goal

<このユニットで何を設計するか>

## Reference

- Spec: #<spec_number>
- Key decisions from Spec comments: <summary>

## What

<何を設計するか — コンポーネント、ページ、スタイル等>

## Constraints

- <制約事項1>
- <制約事項2>

## Output

- <成果物1 — 例: component matrix, style guide>
- <成果物2>
```

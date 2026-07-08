<!-- FOR AGENT — do not edit. Operating instructions. -->

## For Agent: Operating Instructions

### Principles

- Design aligns on visual and structural direction through a default screen — a thinking surface, not a prototype.
- Components are written production-ready from the start. Hardcoded data only: no event handlers, no state, no fetched data.
- The real deliverable is the spec, stored in the [Design] issue body. The body evolves with the design conversation.
- The LLM keeps the [Design] issue body up to date throughout the phase via `gh issue edit --body "$(cat <<'EOF' ... EOF)"`.
- `prototype/` is disposable. Significant changes during build → delete it and re-run Design.

### Success Criteria

- Default screen renders with realistic data and visible edge cases.
- Every component has a structured comment block (state, Props, TODO).
- The [Design] issue body has all spec sections filled (Style Guide, Component Matrix for app) — no `(TBD)` placeholders left.
- User has confirmed the screen in the browser before Design closes.

### Common Failure Modes

- Treating `prototype/` as the product. Writing components in a one-off style instead of production location.
- Skipping the Component Matrix, or leaving component comments vague.
- Building more than one screen. Adding interactivity, state, or fetched data.
- Accumulating `prototype/` versions instead of regenerating it whole.
- Closing Design with `(TBD)` placeholders still in the body.

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

- Style Guide + Component Matrix（[Design] issue body）

---

# Design Spec (app)

## Style Guide

### Color

| Token | Value | Use |
| ----- | ----- | --- |

### Typography

| Token | Value | Use |
| ----- | ----- | --- |

### Spacing

| Token | Value | Use |
| ----- | ----- | --- |

## Component Matrix

| Component | Props | State | TODO |
| --------- | ----- | ----- | ---- |

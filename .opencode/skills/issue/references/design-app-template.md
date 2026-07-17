# Design (app) Template

Use this template for the Design (app) issue body. Reference the Spec issue's body and all comments when creating. 1 Design issue is open at a time during the design phase.

```markdown
<!-- FOR AGENT — do not edit. Operating instructions. -->

## For Agent: Operating Instructions

### Principles

- Design aligns on visual direction through the Wireframe (default screen) and the Design Spec (Style Guide, Component Matrix, Implementation Matrix).
- The Plan (Slices) is in the body. Slices are vertical user-facing concerns (e.g., "Browse tasks", "Add task"). One slice includes all components for that concern, the index.tsx update, and the comment blocks.
- The Plan format (Slices + Notes) is defined by this template. Prepare fills in the slice list; the agent marks slices done and updates Notes at natural break points.
- The Design Spec is the deliverable. The Wireframe is the visual reference.

### Success Criteria

- Default screen renders with realistic data and visible edge cases.
- Every component has a structured comment block.
- The Design Spec (Style Guide, Component Matrix, Implementation Matrix) is filled with no `(TBD)` placeholders.
- User has confirmed the screen in the browser before Design closes.

### Common Failure Modes

- Treating the default screen as a prototype to maintain. It is a thinking surface.
- Skipping the Component Matrix or leaving component comments vague.
- Building more than one screen. Adding interactivity, state, or fetched data.
- Closing Design with `(TBD)` placeholders still in the body.

<!-- FOR AGENT — do not edit. Operating instructions. -->

---

## Reference

- Spec: #<spec_number>
- Key decisions from Spec comments: <summary>

---

# Plan (進捗管理)

## Slices

- [ ]
- [ ]
- [ ]

## Notes

---

# Wireframe (default screen)
```

+----------------------+
| |
+----------------------+
| |
| |
| |
+----------------------+
| |
+----------------------+

```

---

# Design Spec (app)

## Style Guide

| Token | Value | Use |
| --- | --- | --- |

## Component Matrix

| File | Default | States | Variants |
| --- | --- | --- | --- |

## Implementation Matrix

| File | Functions | API |
| --- | --- | --- |
```

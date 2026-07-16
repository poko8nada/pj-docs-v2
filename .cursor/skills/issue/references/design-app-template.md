# Design (app) Template

Use this template for the Design (app) issue body. Reference the Spec issue's body and material comments when creating. 1 Design issue is open at a time during the design phase.

Create thin (empty sections). The `design` skill + `references/app.md` produce content; the `issue` skill persists it.

```markdown
<!-- FOR AGENT — do not edit. Operating instructions. -->

## For Agent: Operating Instructions

### Principles

- Design aligns on visual direction through the Wireframe (default screen) and the Design Spec (Style Guide, Component Matrix, Implementation Matrix).
- The Plan (Slices) is in the body. Slices are vertical user-facing concerns (e.g., "Browse tasks", "Add task"). One slice includes all components for that concern, the screen composition update, and the comment blocks.
- How to slice and build the thinking surface: `.cursor/skills/design/references/app.md`. This template only holds the body shape.
- The Design Spec is the durable deliverable. The Wireframe is the visual reference. The default screen uses **hardcoded, production-representative data** (realistic + edge cases) — no fetch, no app state.

### Success Criteria

- Default screen renders with realistic data and visible edge cases.
- Every component has a structured comment block.
- The Design Spec (Style Guide, Component Matrix, Implementation Matrix) is filled with no `(TBD)` placeholders when Design closes.
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
|                      |
+----------------------+
|                      |
|                      |
|                      |
+----------------------+
|                      |
+----------------------+

```

---

# Design Spec (app)

## Style Guide

| Token | Value | Use |
| ----- | ----- | --- |

## Component Matrix

| File | Default | States | Variants |
| ---- | ------- | ------ | -------- |

## Implementation Matrix

| File | Functions | API |
| ---- | --------- | --- |
```

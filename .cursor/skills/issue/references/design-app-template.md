# Design (app) Template

Use this template for the Design (app) issue body. Reference the Spec issue's body and material comments when creating. 1 Design issue is open at a time during the design phase.

Create thin (empty sections). The `design` skill + `references/app.md` produce content; the `issue` skill persists it.

```markdown
<!-- FOR AGENT — do not edit. Operating instructions. -->

## For Agent: Operating Instructions

### Principles

- Design aligns on product screen design through the Wireframe, `# Screen`, and slice-built thinking surface.
- `# Grain` and `# Tokens` come from `grain` (soft skill) Mode — Define; design persists them via `issue`. Do not invent tokens without grain.
- `# Screen` (Component Matrix, Implementation Matrix) is product composition — design owns it; grain does not fill these.
- The Plan (Slices) is in the body. Slices are vertical user-facing concerns (e.g., "Browse tasks", "Add task"). One slice includes all components for that concern, the screen composition update, and the comment blocks.
- How to slice and build the thinking surface: `.cursor/skills/design/references/app.md`. This template only holds the body shape.
- The default screen uses **hardcoded, production-representative data** (realistic + edge cases) — no fetch, no app state.

### Success Criteria

- Default screen renders with realistic data and visible edge cases.
- Every component has a structured comment block.
- `# Grain`, `# Tokens`, and `# Screen` are filled with no `(TBD)` placeholders when Design closes.
- User has confirmed the screen in the browser before Design closes.

### Common Failure Modes

- Treating the default screen as a prototype to maintain. It is a thinking surface.
- Skipping the Component Matrix or leaving component comments vague.
- Filling `# Tokens` before `# Grain`, or editing tokens without updating Grain.
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

# Grain

<!-- Populated by grain Mode — Define. design persists; edit only after grain re-Define. -->

### Grain-stable

| Axis | Choice |
| ---- | ------ |

### Behavioral temperament

| Axis | Choice |
| ---- | ------ |

---

# Tokens

<!-- Derived from Grain. Do not change token values without updating Grain. -->

### Color

| Token | Value | Use |
| ----- | ----- | --- |

### Typography

| Token | Value | Use |
| ----- | ----- | --- |

### Spacing

| Token | Value | Use |
| ----- | ----- | --- |

### Radius

| Token | Value | Use |
| ----- | ----- | --- |

---

# Screen

## Component Matrix

| File | Default | States | Variants |
| ---- | ------- | ------ | -------- |

## Implementation Matrix

| File | Functions | API |
| ---- | --------- | --- |
```

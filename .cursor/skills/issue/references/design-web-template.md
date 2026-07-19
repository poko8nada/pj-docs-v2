# Design (web) Template

Use this template for the Design (web) issue body. Reference the Spec issue's body and material comments when creating. 1 Design issue is open at a time during the design phase.

Create thin (empty sections). The `design` skill + `references/web.md` produce content; the `issue` skill persists it.

```markdown
<!-- FOR AGENT — do not edit. Operating instructions. -->

## For Agent: Operating Instructions

### Principles

- Design aligns on product screen design through the Wireframe, `# Screen`, and slice-built thinking surface.
- `# Grain` and `# Tokens` come from `grain` (soft skill) Mode — Define; design persists them via `issue`. Do not invent tokens without grain.
- `# Screen` (Web Type, Page Structure, Section Matrix, Implementation Matrix) is product composition — design owns it; grain does not fill these.
- The Plan (Slices) is in the body. Slices are vertical user-facing concerns (e.g., "Hero", "Features"). One slice includes all sections for that concern, the page composition update, and the comment blocks.
- How to slice and build the thinking surface: `.cursor/skills/design/references/web.md`. This template only holds the body shape.
- The homepage uses **hardcoded, production-representative data** (realistic + edge cases) — no fetch, no app state.

### Success Criteria

- Homepage renders with realistic data and visible edge cases.
- Every section has a structured comment block.
- `# Grain`, `# Tokens`, and `# Screen` are filled with no `(TBD)` placeholders when Design closes.
- User has confirmed the screen in the browser before Design closes.

### Common Failure Modes

- Treating the homepage as a prototype to maintain. It is a thinking surface.
- Skipping the Section Matrix or leaving section comments vague.
- Filling `# Tokens` before `# Grain`, or editing tokens without updating Grain.
- Building more than one page. Adding interactivity, state, or fetched data.
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

# Wireframe (homepage)
```

+----------------------+
| |
+----------------------+
| |
| |
+----------------------+
| |
| |
+----------------------+
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

## Web Type

## Page Structure

| Page | URL | Sections |
| ---- | --- | -------- |

## Section Matrix

| Section | Layout (PC) | Layout (Mobile) | Main parts |
| ------- | ----------- | --------------- | ---------- |

## Implementation Matrix

| File | Functions | API |
| ---- | --------- | --- |
```

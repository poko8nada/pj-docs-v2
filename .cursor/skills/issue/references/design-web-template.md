# Design (web) Template

Use this template for the Design (web) issue body. Reference the Spec issue's body and material comments when creating. 1 Design issue is open at a time during the design phase.

Create thin (empty sections). The `design` skill + `references/web.md` produce content; the `issue` skill persists it.

```markdown
<!-- FOR AGENT — do not edit. Operating instructions. -->

## For Agent: Operating Instructions

### Principles

- Design aligns on visual direction through the Wireframe (homepage) and the Design Spec (Web Type, Style Guide, Page Structure, Section Matrix, Implementation Matrix).
- The Plan (Slices) is in the body. Slices are vertical user-facing concerns (e.g., "Hero", "Features", "Post list"). One slice includes all sections for that concern, the page composition update, and the comment blocks.
- How to slice and build the thinking surface: `.cursor/skills/design/references/web.md`. This template only holds the body shape.
- The Design Spec is the durable deliverable. The Wireframe is the visual reference. The homepage uses **hardcoded, production-representative data** (realistic + edge cases) — no fetch, no app state.

### Success Criteria

- Homepage renders with realistic data and visible edge cases.
- Every section has a structured comment block.
- The Design Spec (Web Type, Style Guide, Page Structure, Section Matrix, Implementation Matrix) is filled with no `(TBD)` placeholders when Design closes.
- User has confirmed the screen in the browser before Design closes.

### Common Failure Modes

- Treating the homepage as a prototype to maintain. It is a thinking surface.
- Skipping the Section Matrix or leaving section comments vague.
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
|                      |
+----------------------+
|                      |
|                      |
+----------------------+
|                      |
|                      |
+----------------------+
|                      |
|                      |
+----------------------+
|                      |
+----------------------+

```

---

# Design Spec (web)

## Web Type

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

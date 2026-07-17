# Design (web) Template

Use this template for the Design (web) issue body. Reference the Spec issue's body and all comments when creating. 1 Design issue is open at a time during the design phase.

```markdown
<!-- FOR AGENT — do not edit. Operating instructions. -->

## For Agent: Operating Instructions

### Principles

- Design aligns on visual direction through the Wireframe (homepage) and the Design Spec (Web Type, Style Guide, Page Structure, Section Matrix, Implementation Matrix).
- The Plan (Slices) is in the body. Slices are vertical user-facing concerns (e.g., "Hero", "Features", "Post list"). One slice includes all sections for that concern, the index.tsx update, and the comment blocks.
- The Plan format (Slices + Notes) is defined by this template. Prepare fills in the slice list; the agent marks slices done and updates Notes at natural break points.
- The Design Spec is the deliverable. The Wireframe is the visual reference.

### Success Criteria

- Homepage renders with realistic data and visible edge cases.
- Every section has a structured comment block.
- The Design Spec (Web Type, Style Guide, Page Structure, Section Matrix, Implementation Matrix) is filled with no `(TBD)` placeholders.
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

# Design Spec (web)

## Web Type

## Style Guide

### Color

| Token | Value | Use |
| --- | --- | --- |

### Typography

| Token | Value | Use |
| --- | --- | --- |

### Spacing

| Token | Value | Use |
| --- | --- | --- |

## Page Structure

| Page | URL | Sections |
| --- | --- | --- |

## Section Matrix

| Section | Layout (PC) | Layout (Mobile) | Main parts |
| --- | --- | --- | --- |

## Implementation Matrix

| File | Functions | API |
| --- | --- | --- |
```

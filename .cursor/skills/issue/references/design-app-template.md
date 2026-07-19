# Design (app) Template

Use this template for the Design (app) issue body. Reference the Spec issue's body and material comments when creating. 1 Design issue is open at a time during the design phase.

Create thin (empty sections). The `design` skill + `references/app.md` produce content; the `issue` skill persists it.

```markdown
<!-- FOR AGENT — do not edit. Operating instructions. -->

## For Agent: Operating Instructions

### Principles

- Design aligns on the **default / home** thinking surface, then inventories the wider product at close.
- Stage order: Analyze → Grain Define → Default Component Matrix → Slices (build order) → build → All Component Matrix close. Details: `.cursor/skills/design/references/app.md`.
- `# Grain` and `# Tokens` come from `grain` Mode — Define; design persists them via `issue`. Do not invent tokens without grain.
- **Default Component Matrix** = what belongs on the default screen (thin plan first; reconcile after build).
- **All Component Matrix** = product-wide components needed, including ones not built on the thinking surface.
- **Implementation Matrix** = close only (hooks / APIs / unbuilt work).
- Slices are build order over the Default matrix — not the first planning step.
- Persist issue updates at **milestones** (create, Grain agree, session end, close) — not after every slice or chat tweak.
- The default screen uses **hardcoded, production-representative data** — no fetch, no app state.

### Success Criteria

- Default screen renders with realistic data and visible edge cases.
- Every built component has a structured comment block.
- `# Grain`, `# Tokens`, Default + All matrices (and Implementation as needed) filled with no `(TBD)` when Design closes.
- User has confirmed the screen in the browser before Design closes.

### Common Failure Modes

- Treating the default screen as a prototype to maintain. It is a thinking surface.
- Slicing before Default matrix; filling All matrix before building.
- Skipping All inventory (unbuilt-but-needed) at close.
- Filling `# Tokens` before `# Grain`, or editing tokens without updating Grain.
- Building more than the default screen on the thinking surface. Adding interactivity, state, or fetched data.
- Commenting / editing the issue after every small agreement.
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

## Default Component Matrix

<!-- Plan: File + Role. After build: thicken Default / States / Variants as needed. -->

| File | Role | Default | States | Variants |
| ---- | ---- | ------- | ------ | -------- |

## All Component Matrix

<!-- Close inventory: product-wide, including not built on the thinking surface. -->

| File | Default | States | Variants |
| ---- | ------- | ------ | -------- |

## Implementation Matrix

<!-- Close only. -->

| File | Functions | API |
| ---- | --------- | --- |
```

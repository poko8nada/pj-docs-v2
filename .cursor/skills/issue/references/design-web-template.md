# Design (web) Template

Use this template for the Design (web) issue body. Reference the Spec issue's body and material comments when creating. 1 Design issue is open at a time during the design phase.

Create thin (empty sections). The `design` skill + `references/web.md` produce content; the `issue` skill persists it.

```markdown
<!-- FOR AGENT — do not edit. Operating instructions. -->

## For Agent: Operating Instructions

### Principles

- Design aligns on the **top / home** thinking surface, then inventories the wider site at close.
- Stage order: Analyze → Grain Define → Default Section Matrix → Slices (build order) → build → All Section Matrix close. Details: `.cursor/skills/design/references/web.md`.
- `# Grain` and `# Tokens` come from `grain` Mode — Define; design persists them via `issue`. Do not invent tokens without grain.
- **Default Section Matrix** = what belongs on the top/home screen (thin plan first; reconcile after build).
- **All Section Matrix** = site-wide sections needed, including ones not built on the thinking surface (e.g. Blog post detail).
- **Page Structure** / **Implementation Matrix** = close (or when agreed at a milestone) — not early Prepare.
- Slices are build order over the Default matrix — not the first planning step.
- Persist issue updates at **milestones** (create, Grain agree, session end, close) — not after every slice or chat tweak.
- The homepage uses **hardcoded, production-representative data** — no fetch, no app state.

### Success Criteria

- Homepage renders with realistic data and visible edge cases.
- Every built section has a structured comment block.
- `# Grain`, `# Tokens`, and `# Screen` (Web Type, Default + All, Page Structure / Implementation as needed) filled with no `(TBD)` when Design closes.
- User has confirmed the screen in the browser before Design closes.

### Common Failure Modes

- Treating the homepage as a prototype to maintain. It is a thinking surface.
- Slicing before Default matrix; putting off-default pages into early slices.
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

## Default Section Matrix

<!-- Plan: Section + Role. After build: thicken layouts / parts as needed. -->

| Section | Role | Layout (PC) | Layout (Mobile) | Main parts |
| ------- | ---- | ----------- | --------------- | ---------- |

## All Section Matrix

<!-- Close inventory: site-wide, including not built on the thinking surface. -->

| Section | Layout (PC) | Layout (Mobile) | Main parts |
| ------- | ----------- | --------------- | ---------- |

## Page Structure

| Page | URL | Sections |
| ---- | --- | -------- |

## Implementation Matrix

<!-- Close only. -->

| File | Functions | API |
| ---- | --------- | --- |
```

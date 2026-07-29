# Discover Template

Use for the Discover issue body. One Discover per product. Provisional axes: Name / Look / Stack / Features. No version axis (MVP / Next lives on Build → Roadmap).

```markdown
<!-- FOR AGENT — do not edit. Operating instructions. -->

## For Agent: Operating Instructions

### Shared

- Body = judgment axes: overview + why + `- [ ] agreed`. Concrete results live under `findings/` (append-only).
- Soft skills: one comment per soft on this issue (`## soft: <name>`). Find and **edit** that comment; do not keep stacking new soft comments. Do not paste full dumps into body or comments.
- Do not edit this operating block.

### This issue

- Provisional lock. No version rows here — MVP / Next are defined on Build Roadmap.
- Ready for Build = all sections below agreed (no separate Ready checkbox).

### How to write

- **Name** — one line: chosen name. Then why: 1–3 bullets.
- **Look** — one line: direction. Then why: 1–3 bullets. One line `Path: findings/foundation/…` when a result exists.
- **Stack** — table only (Area / Choice / Reason). No long prose; Research stays in `findings/feasibility/`.
- **Features** — bullets. Prefix `MVP:` or `Later:` when useful. Optional short why bullets at the end of the section.

<!-- FOR AGENT — do not edit. Operating instructions. -->

---

## Name

- [ ] agreed
<!-- 1 line: name. Then why: 1–3 bullets. -->

## Look

- [ ] agreed
<!-- 1 line: direction. Then why. Path: findings/foundation/… when set. -->

## Stack

- [ ] agreed
<!-- Table only. No long prose. -->

| Area | Choice | Reason |
| ---- | ------ | ------ |
|      |        |        |

## Features

- [ ] agreed
<!-- Bullets. Optional MVP: / Later: prefix. Optional why bullets at end. -->

-
-
```

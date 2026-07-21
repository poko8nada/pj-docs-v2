# Build Template

Use for a Build issue body. One open Build at a time; close and open another when the track changes. Roadmap owns MVP / Next definitions; Test strategy and Deploy list concrete bullets under those rows.

```markdown
<!-- FOR AGENT — do not edit. Operating instructions. -->

## For Agent: Operating Instructions

### Shared

- Body = judgment axes: overview + why + `- [ ] agreed`. Concrete results live under `findings/` (append-only).
- Soft skills: one comment per soft on this issue (`## soft: <name>`). Find and **edit** that comment; do not keep stacking new soft comments. Do not paste full dumps into body or comments.
- Do not edit this operating block.

### This issue

- Roadmap defines what MVP and Next mean. Test strategy and Deploy follow those same rows (not a second roadmap).
- No Plan section — next work is derived from axes + findings + product tree, not a fixed schedule in the body.

### How to write

- **Links** — two lines only: `Goal: #N` and `Discover: #M`.
- **Roadmap** — one line of scope per `MVP` / `Next`. Then why: 1–3 bullets.
- **Test strategy** — under `### MVP` / `### Next`, concrete bullets (what is guaranteed). Optional `(why: …)` on a bullet. Long procedures → findings / code.
- **Deploy** — same shape as Test strategy (how it ships: local / CLI / hosted all OK). Optional `(why: …)` on a bullet.

<!-- FOR AGENT — do not edit. Operating instructions. -->

---

## Links

- Goal: #
- Discover: #

## Roadmap

- [ ] agreed
<!-- One line of scope per row. Then why: 1–3 bullets. -->

- **MVP:**
- **Next:**

- why:
  -

## Test strategy

- [ ] agreed
<!-- Concrete bullets under MVP / Next. Optional (why: …) per bullet. -->

### MVP

-

### Next

-

## Deploy

- [ ] agreed
<!-- Same as Test strategy. local / CLI / hosted OK. -->

### MVP

-

### Next

-
```

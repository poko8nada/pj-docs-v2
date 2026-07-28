# Goal Template

Use for the Goal issue body. One Goal per product. Covenant: What is this / Goal / Non-goal.

```markdown
<!-- FOR AGENT — do not edit. Operating instructions. -->

## For Agent: Operating Instructions

### Shared

- Body = judgment axes: overview + why + `- [ ] agreed`. Concrete results live under `findings/` (append-only).
- Soft skills: one comment per soft on this issue (`## soft: <name>`). Find and **edit** that comment; do not keep stacking new soft comments. Do not paste full dumps into body or comments.
- Do not edit this operating block.

### This issue

- Covenant. After a section is agreed, change it only for project redefinition.

### How to write

Covenant = **outcome** (who changes how, and why it matters) — not features, stack, or screens. Discover may inform Goal; distill upward from concrete material, do not copy Discover axes into Goal.

- **What is this** — one line: who + situation + problem or need (form: app/web/API/… is optional, last). Then why: 1–3 bullets.
- **Goal** — one line covenant (measurable or observable outcome when possible). Then why: 1–3 bullets.
- **Non-goal** — bullets only (short). Things a reasonable reader might expect but this project deliberately excludes. Optional `(why: …)` — deferred / rejected / out-of-domain.

**Abstraction test (Goal):** Ask why up to three times. If the answer is a feature, screen, technology, or MVP list → that belongs on Discover or Build, not Goal.

**Good Goal (outcome):** Help small teams agree what they are building before they over-specify.

**Bad Goal (feature in disguise):** Build a Next.js app with drag-and-drop and real-time sync.

**Do not put in Goal** — feature names, UI flows, stack choices, MVP/Later lists, roadmap rows. Those live on Discover (Name / Look / Stack / Features) or Build (Roadmap).

**Non-goal shapes (pick one per bullet when useful):**

- Deferred — out of scope now; tracked elsewhere `(why: …)`
- Rejected — decided not to pursue `(why: …)`
- Out-of-domain — owned elsewhere or not this product's job `(why: …)`

<!-- FOR AGENT — do not edit. Operating instructions. -->

---

## What is this

- [ ] agreed
<!-- 1 line: who + situation + need. Form optional. Then why: 1–3 bullets. -->

## Goal

- [ ] agreed
<!-- 1 line outcome covenant. Then why: 1–3 bullets. Not features/stack/screens. -->

## Non-goal

- [ ] agreed
<!-- Bullets: expected-but-excluded. Optional (why: …). Deferred / rejected / out-of-domain. -->

-
-
```

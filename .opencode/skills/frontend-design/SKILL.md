---
name: frontend-design
description: Design and refine frontend interfaces at the depth the user needs. Use when the user asks to build, style, or improve web components, pages, or applications.
---

## Overview

Design quality is determined in this order: **Lv1 (70%) → Lv2 (20%) → Lv3 (10%)**.
Lv2 and Lv3 collapse without a solid Lv1 foundation.

---

## Step 0: Determine the Level

Infer from the user's words before asking:

| User says                                       | Level |
| ----------------------------------------------- | ----- |
| "fix spacing" "clean up" "tidy this up"         | Lv1   |
| "redesign" "make it look good" "refresh the UI" | Lv2   |
| "memorable" "wow factor" "something impressive" | Lv3   |

If ambiguous, ask once:

> - **Lv1** — Structure and hierarchy only. No color or font changes.
> - **Lv2** — Full visual redesign. I'll ask a few questions first.
> - **Lv3** — Lv2 + atmosphere, depth, signature interaction.

---

## Step 0.5: Design System Generation (ui-ux-pro-max)

**Run for Lv2 / Lv3 only. Skip for Lv1.**

Check if `.cursor/skills/ui-ux-pro-max/` exists. If it does, run:

```bash
python3 .cursor/skills/ui-ux-pro-max/scripts/search.py \
  "[product category / project description]" --design-system -p "[project name]"
```

Extract the following from the output and use as **input for Lv2/Lv3**:

| Output field             | Where it feeds in                         |
| ------------------------ | ----------------------------------------- |
| `STYLE`                  | Starting point for Lv2 "Design direction" |
| `COLORS`                 | Initial palette for Lv2 "Color"           |
| `TYPOGRAPHY`             | Font pairing for Lv2 "Typography"         |
| `KEY EFFECTS`            | Animation character for Lv3 "Interaction" |
| `AVOID (Anti-patterns)`  | Hard constraints across all levels        |
| `PRE-DELIVERY CHECKLIST` | Append to self-evaluation before shipping |

If the script does not exist or errors out, **skip and proceed to Step 1**.

---

## Step 1: Analyze Before Touching Code

Before writing anything, read the existing UI and state:

- What is the primary message this UI must communicate?
- Where does the visual hierarchy break down?
- What is the worst offender — spacing, contrast, alignment, or grouping?

Do not skip this. Local fixes without global diagnosis produce local improvements at best.

---

## Level 1 — Structure & Hierarchy

**Goal**: Make it immediately clear what matters and in what order.

### Scope

**Allowed**: spacing, size relationships, alignment, grouping, component proportion, basic interaction states (hover, focus, active, disabled)
**Off-limits**: font families, color palette, layout paradigm changes, animation

### Think in 3 phases

**Phase 1 — Macro**
Before touching elements, assess the whole canvas:

- Is the visual center where it should be?
- Does the negative space feel intentional or leftover?
- Can you trace a clear visual path from most to least important?

**Phase 2 — Hierarchy**
Apply CRAP. The most common failure is insufficient contrast — sizes that are too close, weights that don't commit.

- **Be bold. If you think the size difference is enough, make it bigger.**
- H1 vs body, primary CTA vs secondary action — the gap should be uncomfortable before it's right.
- Proximity should make groupings feel obvious without labels.

**Phase 3 — Micro**

- Every element aligns to something — not just locally, but within the whole grid.
- Consistent spacing units (4px / 8px base). Repetition builds trust.

### Self-evaluation (required)

After implementing, step back and ask:

1. Can a new user identify the #1 priority in under 3 seconds?
2. Is anything sitting in an ambiguous position — not clearly part of a group, not clearly separate?
3. Is the contrast ratio between hierarchy levels large enough to feel intentional?

If any answer is "no" or "maybe", fix it before finishing.

---

## Level 2 — Visual Language

**Goal**: Establish what this interface _is_ — its voice, personality, and aesthetic conviction.
Lv1 rules apply in full. Lv2 adds: typography, color, spatial composition, and interaction personality.

### Ask first (required)

1. Who uses this, and what problem does it solve?
2. What emotional tone? (e.g., professional, playful, urgent, calm, editorial)
3. Constraints — framework, existing system, anything to preserve?

### Design direction

**If Step 0.5 produced output, use it as the starting point. Otherwise, decide independently using the rules below.**

Commit to a specific aesthetic before writing code. Not "modern and clean" — pick an extreme:
brutally minimal / maximalist / retro-futuristic / luxury / brutalist / organic / utilitarian / editorial

- **Typography**: Font choice establishes personality faster than anything else. Avoid Inter, Roboto, Arial, Space Grotesk. Pair a distinctive display font with a refined body font.
- **Color**: One dominant, one or two sharp accents. Use CSS variables. No timid, evenly spread palettes.
- **Layout**: Asymmetry, generous negative space, or controlled density. Avoid predictable symmetry.

### Interaction states (Lv2)

Hover, focus, and active states carry personality. A luxury UI transitions slowly; a brutalist UI snaps. Design states intentionally — don't use browser defaults.

### Pre-delivery checklist (Lv2)

Use the checklist from Step 0.5 if available. Otherwise, verify at minimum:

- [ ] All clickable elements have `cursor-pointer`
- [ ] Hover states use smooth transitions (150–300ms)
- [ ] Text contrast ratio meets 4.5:1 minimum
- [ ] `prefers-reduced-motion` respected
- [ ] Responsive breakpoints tested (375 / 768 / 1024 / 1440px)
- [ ] Icons are SVG (Heroicons / Lucide) — no emojis as icons
- [ ] Focus states visible for keyboard navigation

---

## Level 3 — Atmosphere & Memory

**Goal**: Lv2, plus one thing the user will remember.

Lv2 must be complete first. Then ask: _what is the single most memorable thing this interface could do?_ Build that — and only that.

### Atmosphere

- No solid backgrounds. Use gradient meshes, noise, layered transparency, or grain — matched to the aesthetic.
- Depth through shadow, z-axis layering, or parallax.

### Interaction (Lv3)

**Reference `KEY EFFECTS` from Step 0.5 to set the animation character.**

Motion should feel inevitable for this UI, not generic:

- **Load**: One orchestrated entrance. Staggered reveals beat scattered micro-interactions.
- **Interaction**: Hover and focus states that surprise without distracting.
- **Scroll**: Trigger effects on viewport entry when it serves the narrative.

Match animation character to aesthetic — brutalist moves snap; luxury moves slowly.
Prefer CSS-only for HTML. Use Motion library for React.

### The signature detail

One element that could not exist in any other context. Specific to this UI's purpose, audience, and tone. Doesn't need to be large — must be intentional.

---

## Always

- Never default to the same fonts (Inter, Roboto, Space Grotesk) — vary every time.
- Never produce a layout that could belong to any other project.
- Never be conservative with contrast. If in doubt, push harder.
- Vary light/dark and aesthetic direction across generations.
- Treat Anti-patterns from Step 0.5 as hard constraints, not suggestions.

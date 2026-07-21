# Style axes and token derivation

Axes describe _character_. Tokens (color, font, spacing) implement character — decide axes first.

## Decision layers

| Layer            | When                                                    | Examples                                                           |
| ---------------- | ------------------------------------------------------- | ------------------------------------------------------------------ |
| **Grain-stable** | Define, before tokens                                   | Axes, layout shell, depth strategy, hierarchy method, radius band  |
| **Rules**        | Always — see [craft.md](craft.md), [audit.md](audit.md) | Icon discipline, motion floors, accessibility                      |
| **Token**        | Define, last step                                       | Color values, font families, spacing/radius px                     |
| **Deferred**     | Content work later                                      | Photo assets, copy, illustration style, widget layout inside cards |

**Grain-stable** = survives a palette or font swap. **Token** = implementation values derived from stable choices (e.g. airy density → 4px grid with ~1.5× multiplier → `--space-4: 16px`).

Card **chrome** (border, shadow, radius band, padding rhythm) is grain-stable. Card **content layout** (sparkline in a metric card, etc.) is composition — not grain.

Icon **usage** is a Rule (text-first). Icon **style** (outline vs filled) follows Form language — grain-stable band.

## Visceral axes (ornamentation and first read)

Rate each axis on a spectrum or pick a pole. Use 1–5 only when a numeric scale helps discussion.

| Axis                  | Low pole                     | High pole                            | Drives                              |
| --------------------- | ---------------------------- | ------------------------------------ | ----------------------------------- |
| Layout shell          | Top nav, few sections        | Sidebar, multi-destination app       | Nav pattern, chrome structure       |
| Density               | Airy, generous whitespace    | Compact, information-forward         | Spacing scale, line height          |
| Form language         | Sharp, geometric             | Soft, rounded, organic               | Border radius band, icon style      |
| Ornamentation         | Bare, functional             | Decorative, textured                 | Backgrounds, dividers, illustration |
| Hierarchy expression  | Subtle size steps            | Bold contrast, dramatic scale        | Type scale, weight contrast         |
| Depth                 | Flat, border-defined         | Layered elevation, shadow            | Shadow strategy, surface tints      |
| Edge treatment        | Hairline borders             | Borderless, shadow or gradient edges | Card chrome, separators             |
| Whitespace philosophy | Whitespace as breathing room | Whitespace as structural grid        | Section rhythm, max-width           |
| Imagery role          | Text and UI only             | Photography or illustration-led      | Hero treatment (material deferred)  |
| Typographic role      | Uniform weight, quiet        | Strong display vs calm body          | Role split before font family       |
| Brand register        | Neutral, utilitarian         | Distinctive, editorial, luxurious    | Accent restraint, motion amount     |

### Visceral → token hints (not prescriptions)

| Axis tendency      | Typical token direction                                        |
| ------------------ | -------------------------------------------------------------- |
| Low ornamentation  | Near-monochrome structure; color for meaning only              |
| High depth         | Layered shadows or surface shifts; one depth strategy app-wide |
| Soft form language | Larger radius band (e.g. 8–12px); avoid mixing sharp and soft  |
| Bold hierarchy     | Fewer type sizes, larger jumps; one clear focal point per view |
| Editorial register | Display + body pairing; generous line length limits            |

## Behavioral axes (interaction temperament)

| Axis               | Low pole                     | High pole                               | Drives                         |
| ------------------ | ---------------------------- | --------------------------------------- | ------------------------------ |
| Response speed     | Instant (~100ms feedback)    | Relaxed (~250–300ms)                    | Transition duration            |
| Motion amount      | Static; CSS-only states      | Staggered reveals, scroll-linked motion | Animation budget               |
| Feedback strength  | Color or opacity shift       | Scale, shadow, or combined              | Hover, active, focus treatment |
| Scroll character   | Native, unobtrusive          | Choreographed section reveals           | Scroll-driven CSS              |
| Transition clarity | Cross-fade, minimal movement | Shared-element or spatial transitions   | Route and modal patterns       |

### Microinteraction structure

For each interactive control, specify (mentally or in comments):

1. **Trigger** — click, hover, focus, scroll, system event
2. **Rules** — what changes, in what order, what is disabled
3. **Feedback** — how the user knows the rule fired (never rely on invisible rules)
4. **Loops / modes** — repeat, timeout, infrequent mode (e.g. settings)

Reference: Dan Saffer — Trigger, Rules, Feedback, Loops.

### Motion defaults (starting points)

| Context                        | Duration  | Easing      |
| ------------------------------ | --------- | ----------- |
| Toggle, checkbox, button press | ~100ms    | ease-out    |
| Panel, modal enter             | 200–300ms | ease-out    |
| Panel, modal exit              | 150–200ms | ease-in     |
| Large page transition          | ≤400ms    | ease-in-out |

Frequent animations should be shorter and subtler than rare ones.

## Reflective axes (afterglow)

| Axis            | Question                                               |
| --------------- | ------------------------------------------------------ |
| Trust posture   | Should this feel safe, playful, expert, or disruptive? |
| Distinctiveness | What one thing should users remember?                  |
| Audience fit    | Who should feel "this is for me" on first glance?      |
| Self-image      | What does using this say about the user?               |

Reflective choices constrain visceral register and behavioral boldness. A financial product rarely uses playful motion; a creative tool may.

## Deriving tokens (last step in Define)

Grain-stable axes and behavioral temperament must be agreed first. Then map to tokens:

1. Fix all three levels in plain language (one paragraph or table).
2. Map axes to:
   - **Color** — foundation temperature (warm / cool / neutral), light or dark, one accent role
   - **Typography** — display vs body roles (typographic role axis), then font families
   - **Spacing** — density axis → base grid (e.g. 4px) and multiplier (airy vs compact)
   - **Radius** — form language axis → band (e.g. sharp 4–6px vs soft 8–12px), then exact steps
3. Return `# Grain` and `# Tokens` markdown to the caller (and into `findings/grain/` when the skill confirms); otherwise the caller applies tokens in code (CSS variables, theme tokens).

Do not lock token values before grain-stable choices are set. Band (grain) before number (token).

If axes conflict (e.g. high density + airy whitespace), resolve in chat before tokens.

# Implementation craft

Quality floor when grain is expressed in code. Read during **Improve** and **Create** after axes and tokens are set.

Grain decides _character_; craft keeps execution precise and consistent.

## Spacing

- Base grid: **4px** (4, 8, 12, 16, 24, 32).
- **Symmetric padding** on components unless content naturally balances (avoid arbitrary TLBR mismatch).
- Match density axis: airy grain uses upper half of the scale; compact grain uses lower.

## Depth (pick one strategy per product)

Commit to one approach app-wide:

| Strategy               | When it fits grain                              |
| ---------------------- | ----------------------------------------------- |
| **Borders only**       | Flat, technical, dense — Linear-style restraint |
| **Single soft shadow** | Approachable, gentle lift                       |
| **Layered shadows**    | Premium, substantial cards                      |
| **Surface tint only**  | Minimal; hierarchy via background shifts        |

Do not mix strategies on different card types.

## Typography

- One clear hierarchy per view: display → section → body → label.
- Headlines: semibold (600), tight tracking; body: regular (400–500).
- Scale example: 11, 12, 13, 14 (base), 16, 18, 24, 32 — adapt to project.
- Numbers, IDs, timestamps: monospace or `tabular-nums` where data aligns.

## Color use

- Gray builds structure; **color communicates meaning** (action, status, error, success).
- Four-level contrast system: foreground → secondary → muted → faint — use all four consistently.
- Decorative color is noise unless ornamentation axis is high.

## Controls and affordance

- Interactive controls should feel like crafted objects, not bare text with handlers.
- Custom selects, date pickers, toggles: build styled components; native `<select>` dropdowns break grain on styled UIs.
- Custom select triggers: `display: inline-flex; white-space: nowrap` so label and chevron stay on one line.

## Icon discipline

Default to **text**. Icons cost recognition, screen space, and cognitive load — use only when benefit exceeds cost ([NN/G Icon Usability](https://www.nngroup.com/articles/icon-usability/)).

| Tier | When | Examples |
| --- | --- | --- |
| **Prefer text** | Primary nav, main CTAs, anything a first-time user must understand | "Sign up", "Pricing", section links |
| **Standard symbol only** | Widely standardized, same meaning across products; still label when space allows | Search (magnifying glass), close (×), back (←) |
| **Icon + visible label** | Secondary actions, toolbars, when icon aids scan but meaning is not universal | "Settings" + gear, "Menu" + hamburger |
| **Icon-only** | Rare; tiny repeated actions for expert users; never for primary path without prior learning | Overflow (⋯) for secondary actions |

Rules:

- **5-second rule:** If you cannot name an obvious icon in 5 seconds, use text only.
- **No decorative sets:** Do not add icons to every nav item because one item had a natural icon.
- **Labels always visible** on navigation — not hover-only, not tooltip-only.
- **Hamburger:** Mobile compromise when nav has many items; on desktop prefer visible top or side nav. If used, standard 3-line icon + "Menu" label.
- **Icon-only controls:** `aria-label` required; visible label still preferred for anything non-expert or high-stakes.

## Layout grounding

Screens need context, not floating widgets:

- Where am I? (title, breadcrumb, or active nav state)
- What can I do here? (primary action visible)
- Chrome (header, footer, nav) matches grain — not placeholder styling on production surfaces

## Motion (execute behavioral temperament)

| Interaction              | Target                                  |
| ------------------------ | --------------------------------------- |
| Micro (toggle, hover)    | ~150ms, `cubic-bezier(0.25, 1, 0.5, 1)` |
| Larger transitions       | 200–250ms                               |
| Frequent animations      | Shorter and subtler than rare ones      |
| Enterprise / dense grain | No spring or bouncy easing              |

Enter: ease-out. Exit: ease-in. Linear motion feels mechanical — avoid.

## Dark mode

If grain includes dark surfaces:

- Prefer borders over heavy shadows for definition.
- Desaturate status colors slightly vs light mode.
- Same hierarchy system, inverted values.

## Anti-patterns

- Dramatic drop shadows on small elements
- Mixed depth strategies on one screen
- 2px+ decorative borders
- Color-coded everything (traffic-light KPIs without need)
- Asymmetric padding with no reason
- Polished chrome around confusing content (fix clarity first)
- Icon-only primary nav or CTAs without standard symbols
- Decorative icon sets where text alone would scan faster

## Before shipping

- [ ] Spacing on 4px grid; padding symmetric
- [ ] One depth strategy; radius band consistent
- [ ] Primary action obvious; hierarchy matches grain axes
- [ ] Hover, focus, active states on interactive elements
- [ ] Motion durations match behavioral temperament
- [ ] No icon-only primary actions; nav labels visible; icons pass 5-second rule

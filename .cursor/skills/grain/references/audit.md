# Audit checklists

Run all sections. Score findings separately per level — do not let visceral praise override behavioral or cognitive failures.

On static or CSS-only surfaces (limited or no JS interactivity), section 5 (Interaction and motion) is limited to hover/focus/active and scroll affordance. Re-run full behavioral checks when interactivity exists on the target.

## 1. Five-second clarity (visceral)

Simulate a first-time visitor. Answer from the UI (code or screenshot):

| #   | Question                                  | Pass signal                                                  |
| --- | ----------------------------------------- | ------------------------------------------------------------ |
| 1   | What is this page or product about?       | One clear subject; no guesswork                              |
| 2   | Who is it for?                            | Target user inferable from copy and imagery                  |
| 3   | What action should I take next?           | Primary CTA obvious; not competing with secondary noise      |
| 4   | What is the most visible element?         | Matches intended focal point (hero, headline, or key action) |
| 5   | What three words describe the impression? | Align with agreed brand register                             |

Common failure patterns:

- Brand register mismatch
- Audience misfire
- CTA invisibility
- Hierarchy collapse (everything equal weight)
- Product vs imagination gap (copy and visuals disagree)

## 2. Visual organization

Hierarchy and grouping — how the eye parses the surface.

| #   | Principle        | Check                                                     | Fail signal                      |
| --- | ---------------- | --------------------------------------------------------- | -------------------------------- |
| 1   | Visual hierarchy | One focal point per view; size/weight/space show priority | Everything same size or weight   |
| 2   | Proximity        | Related items grouped; unrelated separated                | Orphan labels, floating controls |
| 3   | Similarity       | Same function looks same (buttons, links, cards)          | Mixed styles for same role       |
| 4   | Figure–ground    | Content readable against background                       | Low contrast body text           |
| 5   | Whitespace       | Rhythm matches density axis                               | Cramped or arbitrarily sparse    |
| 6   | Scan path        | F-pattern or Z-pattern leads to primary action            | Eye lost mid-page                |

## 3. Cognitive load and information architecture

How much the user must think to act.

| #   | Principle               | Check                                                | Fail signal                             |
| --- | ----------------------- | ---------------------------------------------------- | --------------------------------------- |
| 1   | Cognitive load          | ~7±2 distinct chunks visible at once on primary task | Wall of equal-weight cards or nav items |
| 2   | Hick's Law              | Fewer simultaneous choices on main path              | 10+ nav items or CTAs competing         |
| 3   | Progressive disclosure  | Advanced options hidden until needed                 | Full settings dump on first screen      |
| 4   | Recognition over recall | Current state and options visible                    | User must remember prior screen         |
| 5   | Mental model            | Labels match user vocabulary                         | Internal jargon in UI copy              |
| 6   | Wayfinding              | User knows where they are after navigation           | No active state, title, or breadcrumb   |
| 7   | Serial position         | Key message and CTA in high-attention zones          | Buried value prop below fold noise      |

Interface-type hints (pick what applies):

- **Landing:** hero message + one primary CTA; secondary actions demoted
- **Form / checkout:** few fields per step; errors inline and specific
- **Dashboard:** 3–5 priority metrics above fold; rest expandable
- **Navigation:** 5–7 primary destinations; infrequent items grouped

## 4. Icon discipline

Icons trade clarity for decoration when misused. Check against [craft.md](craft.md) icon rules.

| #   | Check                                                       | Fail signal                                                      |
| --- | ----------------------------------------------------------- | ---------------------------------------------------------------- |
| 1   | Primary CTA and main nav use text (or icon + visible label) | Icon-only "Sign up", nav without labels                          |
| 2   | Non-standard actions are not icon-only                      | Custom icons with no label anywhere                              |
| 3   | 5-second rule                                               | Meaning unclear without prior use or hover                       |
| 4   | No decorative icon sets                                     | Every nav row has a different cryptic icon                       |
| 5   | Desktop global nav                                          | Hamburger-only on wide viewports when space allows visible links |
| 6   | Recognition over recall                                     | User must memorize what each icon does                           |
| 7   | Accessibility                                               | Icon-only control missing accessible name                        |

Hamburger-specific: acceptable on mobile with many destinations; flag if it is the only path to global nav on desktop.

## 5. Interaction and motion (behavioral)

| #   | Check              | Fail signal                                     |
| --- | ------------------ | ----------------------------------------------- | ------------------------------------- |
| 1   | Affordance         | Clickable elements look clickable               | Flat text with no cue                 |
| 2   | Fitts's Law        | Primary targets large enough, well-spaced       | Tiny icon-only actions for main tasks |
| 3   | Feedback           | Hover / focus / active on all interactives      | No state change                       |
| 4   | Focus order        | Logical tab path                                | Trap or skip of primary control       |
| 5   | Spatial continuity | Transitions show where content went             | Disorienting jump cuts                |
| 6   | Duration           | Frequent motion ≤300ms                          | Sluggish toggles and hovers           |
| 7   | Scroll             | Predictable; purposeful motion only             | Jank or decorative scroll-jacking     |
| 8   | Async              | Loading and error states on network actions     | Blank wait, silent failure            |
| 9   | Microinteractions  | Trigger → Rules → Feedback complete per control | Invisible state changes               |

## 6. Aesthetic-usability trap

Explicitly ask:

- If the UI looks polished, can a new user still complete the primary task without help?
- Are positive visual comments masking missing labels, weak hierarchy, or hidden actions?
- Does beauty support content, or decorate over confusion?

Flag when visceral checks pass but sections 3–5 fail. Remediation: understanding first, polish second.

## Finding format

```markdown
**[Level] Observation → Impact → Suggestion**

Example (Visceral):
Hero headline is generic; product category unclear in five-second read →
First-time visitors bounce or misidentify offering →
Replace with concrete value proposition; demote secondary CTAs

Example (Cognitive):
12 sidebar items at equal weight →
Decision time rises; users miss primary destinations →
Collapse to 5–7 primaries; group rest under More

Example (Behavioral):
Nav items have no hover or focus state →
Keyboard and pointer users cannot track position →
Add visible focus ring and hover background per tokens

Example (Icon):
Primary nav is icon-only on desktop →
First-time users cannot predict destinations →
Show text labels; reserve icons for scan assist or remove
```

## Severity

| Severity       | When                                                                      |
| -------------- | ------------------------------------------------------------------------- |
| **critical**   | Purpose or primary action unclear; task blocked; no feedback on main path |
| **warning**    | Friction, weak hierarchy, excess choices, motion too slow                 |
| **suggestion** | Grain polish, microcopy, minor consistency                                |

Priority: critical clarity and behavioral blockers → warnings → suggestions.

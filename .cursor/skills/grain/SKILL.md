---
name: grain
description: >-
  Defines, audits, and implements product surface character — visual ornamentation (あしらい),
  first-impression clarity, and interaction feel — through style axes, not upfront color or font
  picks. Runs Define, Audit, Improve, and Create modes; output is UI code. Use when setting visual
  direction, reviewing web or app look-and-feel, improving scroll and click UX, auditing whether
  first-time visitors understand the product at a glance, or before Design Style Guide tokens.
---

# grain

**Grain** is the product's surface character: how it looks, how it reads at first glance, and how it feels to scroll, click, and navigate. Grain is not a palette or type stack — those are derived _after_ the style language is agreed.

Soft skill: callable standalone or from `design` before locking Style Guide tokens. Output is **direct UI creation or improvement**, not a separate brief file.

## Backbone: three levels

Use Don Norman's three levels as the evaluation lens (details in [references/axes.md](references/axes.md)):

| Level          | Question                                               | Grain owns                                           |
| -------------- | ------------------------------------------------------ | ---------------------------------------------------- |
| **Visceral**   | What does a first-time visitor understand at a glance? | Style axes, hierarchy, ornamentation, brand register |
| **Behavioral** | Does use feel clear and pleasant?                      | Interaction temperament, microinteractions, motion   |
| **Reflective** | What impression remains after use?                     | Trust signals, distinctiveness, self-image fit       |

Always evaluate Visceral and Behavioral separately. Good looks must not mask confusion ([aesthetic-usability effect](https://lawsofux.com/aesthetic-usability-effect/)).

## What you own

- Mode choice (Define / Audit / Improve / Create)
- Style language on the three levels (axes + temperament)
- Audit: five-second clarity, visual organization, cognitive load, interaction — see [references/audit.md](references/audit.md)
- Implementation craft when shipping UI — see [references/craft.md](references/craft.md)
- Audit findings with Observation → Impact → Suggestion
- UI code changes that express the agreed grain
- Deriving color, typography, and spacing tokens **from** axes (last step in Define)

## What you do not own

- Phase entry or Design issue lifecycle — `design` / `issue`
- Slice planning or Section Matrix — `design`

## On entry

Inspect the repo and open issues first (Spec, Design if any), then pick a mode from **Context / Understanding / Proposal** — not a bare mode question.

Typical states (anchors for Understanding):

- Spec or Design issue exists, no agreed grain yet → propose **Mode — Define**
- UI exists, user wants review → propose **Mode — Audit** (Define first if grain is unknown and findings need a target)
- Audit done or user named fixes → propose **Mode — Improve**
- Grain agreed, new surface to build → propose **Mode — Create**
- Called from `design` before Style Guide or slices → **Mode — Define**, then return to caller

Revise until the user agrees the mode. If Improve or Create runs without agreed grain, propose axes in chat and get **yes** / **edit** before coding.

## Typical paths

| Goal                                       | Path                                                       |
| ------------------------------------------ | ---------------------------------------------------------- |
| New screen or section                      | Define → Create                                            |
| Existing UI, unknown quality               | Audit → (optional Improve)                                 |
| Existing UI, known issues                  | Improve (Define first if grain unclear)                    |
| Design phase, no Style Guide yet           | Define → caller persists via `design` / `issue`            |
| Polish only, grain already in Design issue | Audit or Improve — skip Define if issue body is sufficient |

Audit alone does not require Improve. Define alone does not require Create.

## Mode — Define

**When:** No agreed style language; or `design` needs grain before Style Guide tokens.

**Prerequisite:** None. Issue-driven context preferred (see Flow).

**Flow:**

1. **Inspect issues** — list and read open Spec and Design issues (`gh` / `issue` skill). Extract Goal, audience, constraints, and any existing Style Guide.
2. **Fallback context** — if no issues: repo UI, planning docs, user description.
3. **Ground proposal** — state what Goal/direction implies for grain before showing axes. Propose **grain-stable** axes and behavioral temperament first (see Decision layers in [references/axes.md](references/axes.md)); compact table or spectrum; no color hex.
4. User agrees: **yes** / **edit** / **no** (revise on edit or no).
5. Derive **tokens** from agreed grain-stable choices — color, typography, spacing, radius numbers — last step only.
6. If caller is `design`, return token table for Design issue Style Guide via `issue`. If standalone, proceed to Create or stop per user.

Do not lock fonts by brand name until axes are agreed. Describe typographic _role_ first (e.g. "quiet body, assertive display").

**Done when:** Grain-stable axes and behavioral temperament agreed; tokens derived (or returned to caller for issue persistence).

## Mode — Audit

**When:** User wants existing UI reviewed; or sanity-check before ship.

**Prerequisite:** Target UI identifiable (code path, screenshot, or description).

**Flow:**

1. Inspect target UI.
2. Run all sections in [references/audit.md](references/audit.md):
   - Five-second clarity (visceral)
   - Visual organization (hierarchy, Gestalt)
   - Cognitive load and IA (choice count, disclosure, wayfinding)
   - Icon discipline (text-first, labels, standard symbols only)
   - Interaction and motion (behavioral)
   - Aesthetic-usability trap (looks good but confuses?)
3. Report per level. Format each finding: **Observation → Impact → Suggestion**
4. End with prioritized fixes (critical / warning / suggestion).

**Done when:** Findings delivered with priority order. No code unless user asks for Improve.

## Mode — Improve

**When:** User wants fixes; or Audit findings to implement.

**Prerequisite:** Grain agreed (from Define, Design issue, or one-line user confirmation).

**Flow:**

1. Confirm grain (recap axes or cite Design issue).
2. Read [references/craft.md](references/craft.md) for the implementation quality floor.
3. Read `.cursor/skills/implement/SKILL.md` to obtain permission, then run `implement` skill.
4. Change UI code directly. Match project stack and conventions.
5. Confirm message: changed files, what shifted on each level, how to verify (browser / scroll / click path).

**Done when:** Agreed fixes shipped and user can verify.

## Mode — Create

**When:** New section, screen, or component surface to build with agreed grain.

**Prerequisite:** Grain agreed (from Define, Design issue, or one-line user confirmation).

**Flow:** Same as Improve steps 1–5. Build from the first pixel; do not invent grain mid-implementation.

**Done when:** New surface renders; grain visible on visceral and behavioral levels.

## Handoffs

| Need                                  | Skill       |
| ------------------------------------- | ----------- |
| Code permission and build rules       | `implement` |
| Thinking-surface slices, Design issue | `design`    |
| Issue read / write (Spec, Design)     | `issue`     |

From `design`: run **Mode — Define** (or confirm grain from Design issue) before filling Style Guide tokens or building slices that set visual direction.

## Anti-patterns

- Starting with color swatches or font lists
- Defining grain without reading Spec / Design issues when they exist
- Declaring grain "done" without five-second clarity check
- Polishing visuals while CTA or purpose is unclear
- Animation longer than ~400ms on frequent interactions (see [references/audit.md](references/audit.md))
- Producing a markdown brief instead of shipping UI when user asked to create or improve

## References

- [references/axes.md](references/axes.md) — style axes, interaction temperament, token derivation
- [references/audit.md](references/audit.md) — clarity, visual organization, cognitive load, icons, interaction, trap
- [references/craft.md](references/craft.md) — spacing, depth, typography, controls, icon discipline, motion

---
name: grain
description: >-
  Soft skill: defines, audits, and briefs product surface character — visual ornamentation
  (あしらい), first-impression clarity, and interaction feel — through style axes, not upfront
  color or font picks. Callable from any phase. Returns # Grain, # Tokens, audit findings, or
  implementation briefs to the caller. Does not invoke rules or phase skills.
---

# grain

**Grain** is the product's surface character: how it looks, how it reads at first glance, and how it feels to scroll, click, and navigate. Grain is not a palette or type stack — those are derived _after_ the style language is agreed.

Soft skill: same layer as `feasibility`, `readme`, and `issue`. Callable from any work phase or standalone. **Self-contained** — do not invoke phase skills or `issue`. Return outputs to the caller; the caller persists and ships when the phase agrees scope.

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
- Craft guidance in briefs — see [references/craft.md](references/craft.md)
- Audit findings with Observation → Impact → Suggestion
- Deriving color, typography, and spacing tokens **from** axes (last step in Define)
- Close gate: Mode — Audit before returning to caller (see below)

## What you do not own

- Phase entry, mode ①/②, or phase close conditions
- Issue create/update / lifecycle — `issue` via the caller
- Slice planning, Section Matrix, or `# Screen` — `design`
- Product code — caller ships agreed briefs when the phase is ready
- Invoking `rules`, `issue`, or phase skills from grain

## When called

**From a phase skill with mode already scoped** (e.g. design needs Define before `# Tokens`): confirm mode in one short line if useful, then run it.

**Standalone / mode unclear:** present **Context / Understanding / Proposal**, pick a mode, revise until agreed.

### By phase (typical triggers)

| Phase      | When to invoke grain                                                                                                                       |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| **Spec**   | Rare. Goal/audience implies strong brand register — note for later Define only                                                             |
| **Design** | After Analyze, before Default matrix: `# Grain` empty → **Define**. Surface drift → **Audit** / **Improve**. Close inventory may use Audit |
| **Forge**  | New UI surface; interactivity landed → **Audit**. Drift from `# Grain` → **Define** / **Improve**                                          |
| **Refine** | UX/visual polish slice → **Audit** / **Improve**. Major re-skin → **Define**                                                               |
| **Chore**  | Exceptional — only when the chore is explicitly grain-doc or audit scope                                                                   |

Design invokes grain for Define once before the Default matrix, then Audit/Improve during surface work. That is orchestration, not ownership — other phases may invoke grain the same way.

## Close gate

Every grain session **must** end with **Mode — Audit** before returning to the caller.

- **Audit-only invoke:** findings delivered = grain done.
- **Define / Improve / Create:** run Audit on the target surface (or the brief's scope), then return Audit findings together with any prior output.

This close gate is internal to grain. It does not set or block any phase's close conditions.

## On entry

Inspect the repo and open issues first (Spec, Design if any), then pick a mode from **Context / Understanding / Proposal** — not a bare mode question.

Typical states (anchors for Understanding):

- No agreed grain yet → propose **Mode — Define**
- UI exists, user wants review → propose **Mode — Audit**
- Audit done or user named fixes → propose **Mode — Improve**
- Grain agreed, new surface to specify → propose **Mode — Create**

Revise until the user agrees the mode. If Improve or Create runs without agreed grain, propose axes in chat and get **yes** / **edit** before briefing.

## Typical paths

| Goal                         | Path                                    |
| ---------------------------- | --------------------------------------- |
| New style language           | Define → Audit (close gate)             |
| Existing UI, unknown quality | Audit (done) or Audit → Improve → Audit |
| Known fixes                  | Improve → Audit                         |
| New surface spec             | Create → Audit                          |

Audit alone does not require Improve. Define alone does not require Create.

## Mode — Define

**When:** No agreed style language; or caller needs `# Grain` / `# Tokens` before composition work.

**Flow:**

1. **Inspect issues** — list and read open Spec and Design issues (`gh` when available). Extract Goal, audience, constraints, and any existing `# Grain` / `# Tokens`.
2. **Fallback context** — if no issues: repo UI, planning docs, user description.
3. **Ground proposal** — state what Goal/direction implies for grain. Propose **grain-stable** axes and behavioral temperament first (see [references/axes.md](references/axes.md)); compact table or spectrum; no color hex.
4. User agrees: **yes** / **edit** / **no** (revise on edit or no).
5. Derive **tokens** from agreed grain-stable choices — color, typography, spacing, radius numbers — last step only.
6. Return `# Grain` and `# Tokens` markdown blocks. Then run **Close gate** (Audit).

Do not lock fonts by brand name until axes are agreed. Describe typographic _role_ first (e.g. "quiet body, assertive display").

**Done when:** Axes and tokens agreed; Audit run; all output returned to caller.

## Mode — Audit

**When:** User wants existing UI reviewed; or close gate after another mode.

**Prerequisite:** Target UI identifiable (code path, screenshot, or description).

**Flow:**

1. Inspect target UI.
2. Run all sections in [references/audit.md](references/audit.md):
   - Five-second clarity (visceral)
   - Visual organization (hierarchy, Gestalt)
   - Cognitive load and IA (choice count, disclosure, wayfinding)
   - Icon discipline (text-first, labels, standard symbols only)
   - Interaction and motion (behavioral) — limited on static thinking surfaces; full check when interactivity exists
   - Aesthetic-usability trap (looks good but confuses?)
3. Report per level. Format each finding: **Observation → Impact → Suggestion**
4. End with prioritized fixes (critical / warning / suggestion).

**Done when:** Findings delivered with priority order.

## Mode — Improve

**When:** User wants fixes briefed; or Audit findings to address.

**Prerequisite:** Grain agreed (from Define, Design issue, or one-line user confirmation).

**Flow:**

1. Confirm grain (recap axes or cite Design issue `# Grain`).
2. Read [references/craft.md](references/craft.md) for the quality floor.
3. Produce an **Improve brief** (format below) — concrete targets, changes on each level, verify steps.
4. Run **Close gate** (Audit) on the same target.

**Done when:** Improve brief and Audit findings returned to caller.

## Mode — Create

**When:** New section, screen, or component surface to specify with agreed grain.

**Prerequisite:** Grain agreed (from Define, Design issue, or one-line user confirmation).

**Flow:**

1. Confirm grain (recap axes or cite Design issue).
2. Read [references/craft.md](references/craft.md).
3. Produce a **Create brief** (format below) — structure, styling per tokens, boundaries. Do not invent grain mid-brief.
4. Run **Close gate** (Audit) on scope (existing adjacent UI or described target).

**Done when:** Create brief and Audit findings returned to caller.

## Output formats

### `# Grain` and `# Tokens` (from Define)

Return markdown blocks for the caller to persist via `issue`. Shape matches Design issue template sections.

### Improve brief

```markdown
## Grain — Improve brief

### Target

- paths / components / surfaces

### Changes

- Visceral: ...
- Behavioral: ...

### Verify

- browser / scroll / click path the caller should use to confirm the brief
```

### Create brief

```markdown
## Grain — Create brief

### Surface

- what to build (section, screen, component)

### Structure

- layout, hierarchy, key elements

### Styling

- per `# Tokens` and craft.md

### Verify

- browser / scroll / click path the caller should use to confirm the brief
```

### Audit (close gate)

Findings per [references/audit.md](references/audit.md). Append after any brief or Define output in the same return.

## Handoffs

Grain does not invoke other skills. Return all output to the **caller** (phase skill or user). The caller persists via `issue` and ships briefs when the phase agrees scope.

## Anti-patterns

- Starting with color swatches or font lists
- Defining grain without reading Spec / Design issues when they exist
- Declaring grain "done" without Close gate Audit
- Polishing visuals while CTA or purpose is unclear
- Animation longer than ~400ms on frequent interactions (see [references/audit.md](references/audit.md))
- Invoking `issue` or phase skills from grain
- Editing product code from grain — return a brief instead

## References

- [references/axes.md](references/axes.md) — style axes, interaction temperament, token derivation
- [references/audit.md](references/audit.md) — clarity, visual organization, cognitive load, icons, interaction, trap
- [references/craft.md](references/craft.md) — spacing, depth, typography, controls (for briefs; caller applies in code)

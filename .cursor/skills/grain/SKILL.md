---
name: grain
description: >-
  Soft skill: define, audit, and brief product surface character — visual ornamentation (あしらい), first-impression clarity, and interaction feel — through style axes, not upfront color or font picks.
  Use from /work mainly on Build surfaces (Discover only lightly if needed). Soft — not a hard gate.
  Writes findings/grain/ and returns Topic / Path / Why / Summary / Axes touched to the caller.
---

# grain

**Grain** is the product's surface character: how it looks, how it reads at a glance, and how it feels to scroll, click, and navigate. Grain is not a palette or type stack — those are derived _after_ the style language is agreed.

Soft skill — nothing hard-denies if skipped. Prefer running when there is a real surface to judge (product UI or a locked look). Write concrete output under `findings/grain/` (create that directory on first write if missing). Return a short handoff block to the caller. Do **not** create or edit GitHub issues from here.

## How the caller slices this skill

1. Agree **Mode** (On entry) — one sitting if needed.
2. Within that Mode, each **Step** is one verifiable unit. Finish and agree a Step before the next.
3. **Close gate Audit** is its own Step after Define / Improve / Create (required before persist).

Do not merge later Steps into one silent pass unless the user explicitly allows a short path.

## Backbone: three levels

Use Don Norman's three levels as the evaluation lens (details in [references/axes.md](references/axes.md)):

- **Visceral** — What does a first-time visitor understand at a glance? Owns: style axes, hierarchy, ornamentation, brand register.
- **Behavioral** — Does use feel clear and pleasant? Owns: interaction temperament, microinteractions, motion.
- **Reflective** — What impression remains after use? Owns: trust signals, distinctiveness, self-image fit.

Always evaluate Visceral and Behavioral separately. Good looks must not mask confusion ([aesthetic-usability effect](https://lawsofux.com/aesthetic-usability-effect/)).

## What you own

- Mode choice (Define / Audit / Improve / Create)
- Style language on the three levels (axes + temperament)
- Audit — see [references/audit.md](references/audit.md)
- Craft guidance in briefs — see [references/craft.md](references/craft.md)
- Deriving tokens **from** axes (Define, after axes agree)
- Writing confirmed output under `findings/grain/` (append-only)
- Handoff fields for the caller

## What you do not own

- Whether this session should run — the caller decides
- GitHub issue bodies or comments
- Product or harness file edits outside `findings/grain/`
- Shipping briefs into the product tree — the caller does that

## On entry — pick Mode

Inspect the repo and open `[Goal]` / `[Discover]` / `[Build]` when useful (read-only). Prefer the **target UI or look**. Recommend a **Mode** and why; agree before Steps.

- No agreed style language → **Define**
- UI / look exists, needs review → **Audit**
- Fixes after Audit (or named polish) → **Improve**
- Grain agreed, new surface to specify → **Create**

**Done when:** User agrees the Mode. Stop here if the caller is slicing.

Typical paths: Define → close-gate Audit; Audit alone; Improve → close-gate Audit; Create → close-gate Audit.

## Mode — Define

**When:** No agreed style language; or caller needs grain / tokens before surface work.

### Step 1 — Inspect context

Read Goal / Discover / Build when present; prior `findings/grain/` or look paths. If thin: repo UI, planning docs, user description, cited look under `findings/foundation/`.

**Done when:** Context for axes is clear enough to propose. Stop if slicing.

### Step 2 — Propose axes

Propose **grain-stable** axes and behavioral temperament ([references/axes.md](references/axes.md)); compact table or spectrum; no color hex yet. Typographic _role_ first — do not lock font brand names yet. User **yes** / **edit** / **no**.

**Done when:** Axes agreed. Stop if slicing.

### Step 3 — Derive tokens

Derive color, typography, spacing, radius from agreed axes. Show `# Grain` and `# Tokens` in chat. User **yes** / **edit** / **no**.

**Done when:** Tokens agreed. Stop if slicing.

### Step 4 — Close gate Audit

Run **Mode — Audit** Steps on the target surface or brief scope (findings not written yet — fold into Step 5).

**Done when:** Audit findings agreed in chat. Stop if slicing.

### Step 5 — Persist and hand off

Ensure `findings/grain/` exists; write `# Grain`, `# Tokens`, and Audit into `findings/grain/<dated-slug>.md`; return handoff.

**Done when:** File written and handoff returned.

## Mode — Audit

**When:** Main review; or close gate after Define / Improve / Create.

**Prerequisite:** Target UI identifiable (code path, screenshot, look path, or description).

### Step 1 — Inspect target

Identify and inspect the surface.

**Done when:** Target is fixed. Stop if slicing.

### Step 2 — Run audit

Run [references/audit.md](references/audit.md). Each finding: **Observation → Impact → Suggestion**. End with prioritized fixes (critical / warning / suggestion). User **yes** / **edit** / **no**.

**Done when:** Findings agreed in chat. Stop if slicing.

### Step 3 — Persist and hand off

**Main Audit only:** on **yes**, write `findings/grain/<dated-slug>.md`, return handoff.

**Close-gate Audit** (after Define / Improve / Create): skip this Step — the parent Mode’s persist Step writes Audit with the rest.

**Done when:** Main Audit → file + handoff. Close-gate → return to parent Mode.

## Mode — Improve

**When:** Fixes briefed; or Audit findings to address.

**Prerequisite:** Grain agreed (Define, prior findings, or one-line user confirmation).

### Step 1 — Confirm grain

Recap axes or cite `findings/grain/` Path.

**Done when:** Grain confirmed. Stop if slicing.

### Step 2 — Improve brief

Read [references/craft.md](references/craft.md). Produce **Improve brief** (format below). User **yes** / **edit** / **no**.

**Done when:** Brief agreed. Stop if slicing.

### Step 3 — Close gate Audit

Run **Mode — Audit** Steps on the same target (persist deferred to Step 4).

**Done when:** Audit findings agreed. Stop if slicing.

### Step 4 — Persist and hand off

Write brief + Audit to `findings/grain/<dated-slug>.md`; return handoff.

**Done when:** File written and handoff returned.

## Mode — Create

**When:** New section / screen / component with agreed grain.

**Prerequisite:** Grain agreed (Define, prior findings, or one-line user confirmation).

### Step 1 — Confirm grain

Recap axes or cite findings Path.

**Done when:** Grain confirmed. Stop if slicing.

### Step 2 — Create brief

Read [references/craft.md](references/craft.md). Produce **Create brief** (format below). Do not invent grain mid-brief. User **yes** / **edit** / **no**.

**Done when:** Brief agreed. Stop if slicing.

### Step 3 — Close gate Audit

Run **Mode — Audit** Steps on scope (persist deferred to Step 4).

**Done when:** Audit findings agreed. Stop if slicing.

### Step 4 — Persist and hand off

Write brief + Audit to `findings/grain/<dated-slug>.md`; return handoff.

**Done when:** File written and handoff returned.

## Output formats

Same shapes in chat (before confirm) and in the findings MD.

### `# Grain` and `# Tokens` (Define)

```markdown
# Grain
…

# Tokens
…
```

### Improve brief

```markdown
## Grain — Improve brief

### Target
- paths / components / surfaces

### Changes
- Visceral: ...
- Behavioral: ...

### Verify
- browser / scroll / click path to confirm
```

### Create brief

```markdown
## Grain — Create brief

### Surface
- what to build

### Structure
- layout, hierarchy, key elements

### Styling
- per Tokens and craft.md

### Verify
- browser / scroll / click path to confirm
```

### Audit

Findings per [references/audit.md](references/audit.md). Append after Define / Improve / Create output in the same findings file.

## Handoff (return to caller)

```markdown
- Topic: …
- Path: findings/grain/<dated-slug>.md
- Why:
  - …
- Summary: …   # optional; at most 3 lines
- Axes touched: …   # optional; e.g. Look, Roadmap
```

## Anti-patterns

- Starting with color swatches or font lists
- Skipping Close gate Audit after Define / Improve / Create
- Polishing visuals while CTA or purpose is unclear
- Animation longer than ~400ms on frequent interactions (see [references/audit.md](references/audit.md))
- Editing GitHub issues from this skill
- Editing product code from grain — return a brief instead
- Overwriting prior `findings/grain/` files without user request
- Skipping `findings/grain/` create on first write
- Running later Steps without prior Step agreement when the caller expects sliced Steps

## References

- [references/axes.md](references/axes.md) — style axes, interaction temperament, token derivation
- [references/audit.md](references/audit.md) — clarity, visual organization, cognitive load, icons, interaction, trap
- [references/craft.md](references/craft.md) — spacing, depth, typography, controls (for briefs; caller applies in code)

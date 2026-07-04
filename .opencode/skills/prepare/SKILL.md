---
name: prepare
description: "Pre-implementation checkpoint. Establish shared understanding of the phase and what's about to be built, then execute the phase-specific workflow (design alignment, build planning, or refinement planning). Must be completed before implementation."
compatibility: opencode
---

# Prepare

The bridge between research and implementation. Before writing code, align on what we're building and how.

## Step 1 — Confirm phase

We should have already decided on the project phase. If not, ask the user.

## Step 2 — Context & Understanding

Before diving into the phase-specific workflow, establish shared understanding. Present in one message:

**Context** (max 2 sentences)
{current phase, what's been decided, what issue/design we're working from. Ground this in the session's discussion and feasibility findings — do not start from scratch.}

**Understanding** (max 3 sentences)
{what this phase requires, what the workflow will look like, what output is expected}

**Proposal** (max 2 sentences)
{which reference applies, key decisions to be made, expected outcome}

Discuss with the user. Revise based on their feedback. Repeat until aligned. Do not proceed to Step 3 until agreement is reached.

## Step 3 — Execute phase workflow

Read the corresponding reference file and follow its workflow. Do not summarize the reference content in chat — the reference is an instruction manual, not discussion material. The discussion happened in Step 2.

## References

- Phase `design`
  - For app → read `references/design-app.md`
  - For website → read `references/design-web.md`
- Phase `build` → read `references/build.md`
- Phase `refine` → read `references/refine.md`

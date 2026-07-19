---
name: refine
description: >-
  This is one of the project phases.
  Use when entering Refine: lock a plan into a Refine issue on existing code, or implement agreed vertical slices from that issue.
disable-model-invocation: true
---

# refine

Improve the existing product with the same two-step discipline as Forge: lock a slice plan, then implement it. Target is the current codebase — not a greenfield feature.

## On entry

Inspect the repo and open issues first (Spec, Design, Forge, Refine if any). Then present **Context / Understanding / Proposal** in one message — your reading of where the project is, not a question dump.

Typical states (use as anchors in Understanding):

- No Refine issue yet, product code exists → propose **Mode ①** (lock the plan)
- Refine issue exists, slices incomplete → propose **Mode ②** (next open slice) or resume ① if the plan itself is wrong
- Refine issue exists but plan section empty / rejected → stay in **Mode ①**

Revise until the user agrees which mode applies. Do not ask “① or ②?” with no grounding.

## Mode ① — Lock the plan

1. Read prior phase issues and the relevant code as source of truth.
2. Run `feasibility` skill before locking technical choices (agent knowledge drifts; do this by default, not only when something “feels risky”).
3. Follow `.cursor/skills/refine/references/plan.md` to produce the plan.
4. Write the agreed plan into the **Refine issue** via `issue` skill. No product code in this mode.

## Mode ② — Implement slices

1. Confirm the Refine issue has an agreed slice list. If not, return to Mode ①.
2. Before any product code edit, Read `.cursor/skills/implement/SKILL.md` to obtain permission to code, then run `implement` skill.
3. Take **one vertical slice** → verify → get user agreement → update the Refine issue via `issue` skill. Repeat. Prefer draft-then-grow over horizontal splits (refactor everything, then test everything).
4. For UX/visual polish slices, or when the product diverges from Design `# Grain` / `# Tokens`, invoke **`grain`** (Audit, Improve, or Define for a major re-skin). Fold returned briefs into the implement unit.

Hand off to `issue` / `feasibility` / `grain` / `implement` by name — do not copy their contents here.

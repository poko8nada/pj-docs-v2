---
name: forge
description: >-
  This is one of the project phases.
  Use when entering Forge: lock a plan into a Forge issue, or implement agreed vertical slices from that issue.
disable-model-invocation: true
---

# forge

Turn Spec + Design into working product: lock a slice plan, then implement it.

## On entry

Inspect the repo and open issues first (Spec, Design, Forge if any). Then present **Context / Understanding / Proposal** in one message — your reading of where the project is, not a question dump.

Typical states (use as anchors in Understanding):

- No Forge issue yet, Spec/Design exist → propose **Mode ①** (lock the plan)
- Forge issue exists, slices incomplete → propose **Mode ②** (next open slice) or resume ① if the plan itself is wrong
- Forge issue exists but plan section empty / rejected → stay in **Mode ①**

Revise until the user agrees which mode applies. Do not ask “① or ②?” with no grounding.

## Mode ① — Lock the plan

1. Read Spec and Design issues as source of truth.
2. Run `feasibility` skill before locking technical choices (agent knowledge drifts; do this by default, not only when something “feels risky”).
3. Follow `.cursor/skills/forge/references/plan.md` to produce the plan.
4. Write the agreed plan into the **Forge issue** via `issue` skill. No product code in this mode.

## Mode ② — Implement slices

1. Confirm the Forge issue has an agreed slice list. If not, return to Mode ①.
2. Before any product code edit, Read `.cursor/skills/implement/SKILL.md` to obtain permission to code, then run `implement` skill.
3. Take **one vertical slice** → verify → get user agreement → update the Forge issue via `issue` skill. Repeat. Prefer draft-then-grow over horizontal splits (all APIs, then all UI).

Hand off to `issue` / `feasibility` / `implement` by name — do not copy their contents here.

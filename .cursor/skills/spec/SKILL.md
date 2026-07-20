---
name: spec
description: >-
  This is one of the project phases.
  Use when entering Spec: discuss and lock product design into a thick Spec issue.
disable-model-invocation: true
---

# spec

Lock product design through discussion, then record it as a **thick Spec issue** (Goal / Scope / Architecture / decisions). Spec is the root for later phases — not a place to ship product code or slice plans.

## On entry

**Harness handshake (required):** Read `.cursor/skills/issue/SKILL.md`, then `issue/references/spec-template.md`. Gate blocks `gh issue` writes until both Reads are done.

Inspect the repo and open issues first (Spec if any; planning docs if no Spec yet). Then present **Context / Understanding / Proposal** in one message — your reading of where the project is, not a question dump.

Typical states (use as anchors in Understanding):

- No Spec issue yet → propose **discuss toward a first thick Spec**, then create via `issue` skill when agreed
- Spec exists but Open Questions / thin sections remain → propose **continue discussion**, then update via `issue` skill
- Spec is solid (sections filled, no blocking Open Questions for v1) → say so; do not invent the next phase — user invokes `/design` / `/forge` / … when ready

Revise until the user agrees the next move. Do not ask “create or update?” with no grounding.

## Flow

1. **Discuss** until Goal, Scope, Architecture, and material decisions are clear enough to write. Keep using Context / Understanding / Proposal as the discussion advances — not a single dump then silence.
2. Before locking **technical** choices in the Spec (especially Stack), run `feasibility` skill by default (agent knowledge drifts).
3. When the user agrees the Spec content, create or update the Spec issue via `issue` skill (template and lifecycle live there — do not copy them here).
4. **No product code** in this phase. If code is ever required in this session, Read `.cursor/skills/rules/SKILL.md` to obtain permission, then follow `rules` — treat that as exceptional.

Hand off to `issue` / `feasibility` / `rules` by name — do not copy their contents here.

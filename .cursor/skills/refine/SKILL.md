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

**Harness handshake (required):** Read `.cursor/skills/issue/SKILL.md`, then `issue/references/refine-template.md`. Gate blocks `gh issue` writes until both Reads are done.

Inspect the repo and open issues first (Spec, Design, Forge, Refine if any). Then present **Context / Understanding / Proposal** in one message — your reading of where the project is, not a question dump.

Typical states (use as anchors in Understanding):

- No Refine issue yet, product code exists → propose **Mode ①** (lock the plan)
- Refine issue exists, slices incomplete → propose **Mode ②** (next open slice) or resume ① if the plan itself is wrong
- Refine issue exists but plan section empty / rejected → stay in **Mode ①**

Revise until the user agrees which mode applies. Do not ask “① or ②?” with no grounding.

## Mode ① — Lock the plan

1. Read prior phase issues and the relevant code as source of truth.
2. Run `feasibility` skill before locking technical choices (agent knowledge drifts; do this by default, not only when something “feels risky”).
3. Follow `.cursor/skills/refine/references/plan.md` to produce the plan — **inventory of improvements first (with tiers), then slice order** (do not slice from an empty list).
4. Write the agreed plan into the **Refine issue** via `issue` skill (milestone). No product code in this mode.

## Mode ② — Implement slices

1. Confirm the Refine issue has an agreed slice list. If not, return to Mode ①.
2. Before any product code edit, Read `.cursor/skills/rules/SKILL.md` to obtain permission to edit, then follow `rules`.
3. Take **one vertical slice** → verify → get user agreement in chat. Prefer draft-then-grow over horizontal splits (refactor everything, then test everything). Repeat.
4. For UX/visual polish slices, or when the product diverges from Design `# Grain` / `# Tokens`, invoke **`grain`** (Audit, Improve, or Define for a major re-skin). Fold returned briefs into the edit unit.

**Issue persist (Refine):** Prefer **milestones**, not per-slice chatter — same idea as Design:

- Mode ① lock (full plan once)
- **Session end** (or “how far we got”) — slice checkboxes / Notes
- Phase close

Do not comment or edit the body after every slice agreement. Chat agreement stays per slice.

**Browser check:** Use the `cmux-browser` skill. Prefer an existing cmux surface and an already-running dev server. If the server is down, read `package.json` scripts and start the right one (prefer `dev`), then open/use cmux.

Hand off to `issue` / `feasibility` / `grain` / `rules` by name — do not copy their contents here.

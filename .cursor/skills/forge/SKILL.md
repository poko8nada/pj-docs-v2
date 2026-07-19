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

**Harness handshake (required):** Read `.cursor/skills/issue/SKILL.md`, then `issue/references/forge-template.md`. Gate blocks `gh issue` writes until both Reads are done.

Inspect the repo and open issues first (Spec, Design, Forge if any). Then present **Context / Understanding / Proposal** in one message — your reading of where the project is, not a question dump.

Typical states (use as anchors in Understanding):

- No Forge issue yet, Spec/Design exist → propose **Mode ①** (lock the plan)
- Forge issue exists, slices incomplete → propose **Mode ②** (next open slice) or resume ① if the plan itself is wrong
- Forge issue exists but plan section empty / rejected → stay in **Mode ①**

Revise until the user agrees which mode applies. Do not ask “① or ②?” with no grounding.

## Mode ① — Lock the plan

1. Read Spec and Design issues as source of truth (especially Design `# Screen` Default / All matrices).
2. Run `feasibility` skill before locking technical choices (agent knowledge drifts; do this by default, not only when something “feels risky”).
3. Follow `.cursor/skills/forge/references/plan.md` to produce the plan — **inventory of capabilities first, then slice order** (do not slice from an empty list).
4. Write the agreed plan into the **Forge issue** via `issue` skill (milestone). No product code in this mode.

## Mode ② — Implement slices

1. Confirm the Forge issue has an agreed slice list. If not, return to Mode ①.
2. Before any product code edit, Read `.cursor/skills/implement/SKILL.md` to obtain permission to code, then run `implement` skill.
3. Take **one vertical slice** → verify → get user agreement in chat. Prefer draft-then-grow over horizontal splits (all APIs, then all UI). Repeat.
4. After UI slices that add interactivity, or when surface drifts from Design `# Grain` / `# Tokens`, invoke **`grain`** (Audit or Improve). Fold returned briefs into the next implement unit or a follow-up slice.

**Issue persist (Forge):** Prefer **milestones**, not per-slice chatter — same idea as Design:

- Mode ① lock (full plan once)
- **Session end** (or “how far we got”) — slice checkboxes / Notes
- Phase close

Do not comment or edit the body after every slice agreement. Chat agreement stays per slice.

**Browser check:** Use the `cmux-browser` skill. Prefer an existing cmux surface and an already-running dev server. If the server is down, read `package.json` scripts and start the right one (prefer `dev`), then open/use cmux.

Hand off to `issue` / `feasibility` / `grain` / `implement` by name — do not copy their contents here.

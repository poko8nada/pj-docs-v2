---
name: design
description: >-
  This is one of the project phases.
  Use when entering Design: agree on default/home via a thin Design issue and a production-ready thinking-surface screen.
disable-model-invocation: true
---

# design

Agree on design direction by building a realistic default/home screen. The screen is the **discussion tool**; the durable output lives in the **Design issue** body (Design Spec).

## On entry

Inspect the repo and open issues first (Spec, Design if any). Then present **Context / Understanding / Proposal** in one message — your reading of where the project is, not a question dump. Confirm **app vs web** in that Proposal when it matters.

Typical states (use as anchors in Understanding):

- Spec exists, no Design issue yet → propose **thin Design issue**, then app or web reference
- Design issue exists, slices incomplete → propose **continue the next open slice** (or re-plan if the slice list is wrong)
- Design Spec is solid and slices done → say so; do not invent Forge — user invokes `/forge` when ready

Revise until the user agrees the next move. Do not ask “app or web?” with no grounding.

## Flow

1. Read the **Spec** issue as source of truth for product intent.
2. Create or update a **thin** Design issue via `issue` skill when needed (template / lifecycle live there).
3. Read **exactly one** reference and follow it (do not paste the whole file into chat):
   - App → `.cursor/skills/design/references/app.md`
   - Web → `.cursor/skills/design/references/web.md`
4. Before any prototype or component code edit, Read `.cursor/skills/implement/SKILL.md` to obtain permission to code, then run `implement` skill.
5. As slice plans and Design Spec sections are agreed, persist them via `issue` skill. One vertical slice at a time when building the screen — user agreement between slices.

Hand off to `issue` / `implement` by name — do not copy their contents here. Feasibility only when Design introduces technical choices beyond the Spec (by default if locking new stack/UI library decisions).

Prototype screens use **hardcoded data** (realistic + edge cases) — that is correct for this phase; do not push live data or forge-style “capability stubs” thinking onto the thinking surface.

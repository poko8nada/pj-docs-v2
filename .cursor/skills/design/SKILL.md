---
name: design
description: >-
  This is one of the project phases.
  Use when entering Design: agree on default/home via a thin Design issue and a production-ready thinking-surface screen.
disable-model-invocation: true
---

# design

Agree on product screen design by building a realistic default/home screen. The screen is the **discussion tool**; the durable output lives in the **Design issue** body (`# Grain`, `# Tokens`, `# Screen`, Plan, Wireframe).

## On entry

**Harness handshake (required):** Read `.cursor/skills/issue/SKILL.md`, then `issue/references/design-app-template.md` or `design-web-template.md` (pick one). Gate blocks `gh issue` writes until both Reads are done.

Inspect the repo and open issues first (Spec, Design if any). Then present **Context / Understanding / Proposal** in one message — your reading of where the project is, not a question dump. Confirm **app vs web** in that Proposal when it matters.

Typical states (use as anchors in Understanding):

- Spec exists, no Design issue yet → propose **thin Design issue**, then app or web reference
- Design issue exists, `# Grain` empty → propose **Analyze** (if needed), then **`grain` Mode — Define**
- `# Grain` filled, Default matrix empty → propose **Default Component/Section Matrix**, then slices
- Slices incomplete → propose **continue the next open slice** (or re-order if the list is wrong)
- Slices done, All matrix empty → propose **close inventory** (All matrix + unbuilt-but-needed)
- `# Grain`, `# Tokens`, and `# Screen` (Default + All) solid → say so; do not invent Forge — user invokes `/forge` when ready

Revise until the user agrees the next move. Do not ask “app or web?” with no grounding.

## Flow

1. Read the **Spec** issue as source of truth for product intent.
2. Create a **thin** Design issue via `issue` when needed (template / lifecycle live there).
3. Read **exactly one** reference and follow it (do not paste the whole file into chat):
   - App → `.cursor/skills/design/references/app.md`
   - Web → `.cursor/skills/design/references/web.md`
4. Follow that reference’s stage order (Analyze → Grain Define → Default matrix → Slices → build → All matrix close).
5. Before any thinking-surface code edit, Read `.cursor/skills/rules/SKILL.md`, then follow `rules`.
6. During surface work, invoke **`grain`** (Audit / Improve) when visceral drift or polish needs a grain pass. Grain’s close gate (Audit) is internal to grain — not a Design phase close condition.

**Issue persist (Design):** Prefer **milestones**, not per-slice chatter. Persist via `issue` at:

- Thin Design issue create
- After Grain Define agreement (`# Grain` / `# Tokens`)
- **Session end** (or “how far we got”) — slice checkboxes / notes
- **Close** — Default matrix reconciled + All matrix + Implementation Matrix filled

Do not comment or edit the body after every small chat agreement. Other phases may tighten later; this rule is for Design.

**Browser check:** Use the `cmux-browser` skill. Prefer an existing cmux surface and an already-running dev server. If the server is down, read `package.json` scripts and start the right one (prefer `dev`), then open/use cmux.

Hand off to `issue` / `rules` / `grain` / `feasibility` by name — do not copy their contents here. Feasibility only when Design introduces technical choices beyond the Spec (by default if locking new stack/UI library decisions).

Prototype screens use **hardcoded data** (realistic + edge cases) — that is correct for this phase; do not push live data or forge-style “capability stubs” thinking onto the thinking surface.

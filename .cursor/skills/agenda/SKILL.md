---
name: agenda
description: >-
  Build the session work agenda for /work: inventory, then thin vertical slices as a table.
  A slice is one row — one verifiable concern. Agent or user may start this; running the skill opens unlock.agenda (work only).
  Always get explicit user agreement before execute — do not implement in the same turn as first presenting the agenda.
---

# agenda

Own **planning and situation guidance for product `/work`**: inventory → slice table → user agreement → execute with the matching situation ref. Session direction stays in `discussion` / `scope`. Harness meta stays in `/chore` (no `unlock.agenda` there).

**Harness:** Running this skill in **work** opens `unlock.agenda` (the harness detects the skill file Read). discussion / chore keep `unlock.agenda` null. File edits in work still need `unlock.scope` and `unlock.rules`.

**Agreement (required):** After presenting inventory and/or the slice table, **stop and wait for the user to agree** (which slice, or the whole agenda) before Execute. Do not invent agreement. Do not start implementation in the same turn as the first agenda dump.

Agent may draft the agenda first; user may ask for an agenda — either is fine. Unlock ≠ permission to code yet.

## Situation refs

Execute the matching file under `references/` for inventory sources, typical work, Test / Surface detail, and after-slice habits:

- Goal / Discover → `references/goal-discover.md`
- Build → `references/build.md`

## Slice

A **slice** is one sitting that adds **one verifiable concern**, cut from an **inventory** — never from an empty list, never as a horizontal layer (all APIs, then all UI, then all tests). Soft and issue work use the same idea (e.g. one look-workshop pass, one axis update).

Do not invent slices from nothing:

1. **Inventory** — short bullets from the situation ref’s inventory sources. No sequence yet.
2. **Slice table** — only then sequence into thin vertical slices (chat only — not on issues).

### Slice table (agree before execute)

One row = one slice. **Includes** + **Test** + **Surface** on the same row enforce a vertical cut.

```markdown
| #   | What        | Includes      | Test    | Surface         |
| --- | ----------- | ------------- | ------- | --------------- |
| 1   | one concern | logic+wire+UI | cmd/N/A | observe product |
```

| Column   | Write                               | Do not write                 |
| -------- | ----------------------------------- | ---------------------------- |
| What     | one concern name                    | file list as the title       |
| Includes | logic + wiring + surface this slice | “later: tests” / “later: UI” |
| Test     | command + angles, or `N/A` + reason | vague “add tests”            |
| Surface  | action → expected on the product    | duplicate Test only          |

Optional dependency: write `prerequisite: …` inside **Includes**.

**Two rules — do not collapse them:**

1. **Concern order** — grow behavior thinly. Incomplete _breadth_ early is fine; incomplete _quality_ is not.
2. **Fidelity** — “draft” means _fewer concerns_, not fake data or sloppy soft output. No throwaway placeholders (`foo`, `lorem`).

**Avoid bundling:** full feature in one slice; horizontal cuts; merging slices because of a dependency.

**Agree in chat per slice** (or the agenda as a whole) before execute. Issue body updates at milestones when needed — not after every slice by default.

## Goal / Discover fills

**Includes:** soft run + `findings/` artifact + issue / axis touch in this slice  
**Test:** `N/A` unless product logic (then Build fills + `references/build.md` Test policy)  
**Surface:** artifact done — e.g. `findings/<path>`; axis / soft comment updated

**Shape examples** (growth order; skip what does not apply):

- Soft: one workshop / research cluster → findings → soft comment refresh
- Look: lock HTML/CSS in workshop → then Discover Look agreed
- Stack: feasibility → findings → Stack axis + soft comment
- Data (Narrow): data-model for discussion / look → findings → soft comment
- Goal: one covenant axis after Discover material — not a product rebuild
- Ready for Build: create `[Build]` with Links + thin Roadmap/Test/Deploy

## Build fills

**Includes:** pure logic + wiring + route/UI/handler for **this** concern only  
**Test:** `pnpm test:run` target or `N/A` — angles and skip rules in `references/build.md`  
**Surface:** human observation on the product — examples in `references/build.md`

**Shape examples** (growth order; skip what does not apply):

- CRUD: display real-shaped records → create → update → delete
- Auth: stubbed sign-in → validation → real provider → errors → loading
- Landing: hero → features → form → footer (real copy)
- Data: data-model Full → schema + seed + display → live reads → C/U/D
- Inventory soft → then code slices from that list
- Soft-on-Build: one soft → findings → comment; code adoption later if needed
- Refine-like: extract one function / one duplication cluster — not “refactor the module”

**Avoid bundling:** full CRUD; whole auth; form + validation + errors + success; horizontal “tests-only” after features.  
**Do** put new logic + its new unit tests in the **same** vertical slice.

## Rail

```text
Inventory → Slice table → User agrees → Execute → Commit
                                         → Issue update when needed
```

## Hard limits

- Do not execute before user agreement on the agenda or the next slice.
- Do not treat the Build issue as a durable list of slices — session slices stay in chat.
- Do not run this gate for `/chore` — harness leaves `unlock.agenda` null there.

Hand off to `work` / `scope` / `issue` / `rules` by name.

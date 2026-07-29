---
name: agenda
description: >-
  Build the session work agenda for /work: inventory, then thin vertical slices as a table.
  A slice is one row — one verifiable concern. Agent or user may start this; unlock.agenda opens on Read (work only).
  Always get explicit user agreement before execute — do not implement in the same turn as first presenting the agenda.
---

# agenda

Own **how product `/work` is cut into slices**. Session direction stays in `discussion` / `scope`. Harness meta stays in `/chore` (no `unlock.agenda` there).

**Harness:** Reading this file in **work** sets `unlock.agenda: true`. discussion / chore keep `unlock.agenda: null` (not gated). File edits in work still need `unlock.scope` and `unlock.rules`.

**Agreement (required):** After presenting inventory and/or the slice table, **stop and wait for the user to agree** (which slice, or the whole agenda) before Execute. Do not invent agreement. Do not start implementation in the same turn as the first agenda dump.

Agent may draft the agenda first; user may ask for an agenda — either is fine. Unlock by Read ≠ permission to code yet.

## Slice

A **slice** is one sitting that adds **one verifiable concern**, cut from an **inventory** — never from an empty list, never as a horizontal layer (all APIs, then all UI, then all tests). Soft and issue work use the same idea (e.g. one look-workshop pass, one axis update).

Do not invent slices from nothing:

1. **Inventory** — short bullets: what is in scope this session. No sequence yet.
2. **Slice table** — only then sequence into thin vertical slices (chat only — not on issues).

### Slice table (agree before execute)

One row = one slice. **Includes** + **Test** + **Surface** on the same row enforce a vertical cut.

Chat shape (not a wide markdown table — columns stay short):

```text
# / What / Includes / Test / Surface / Notes
1 / one concern / logic+wiring+surface / cmd or N/A / observe product / prerequisite: …
```

| Column   | Write                                    | Do not write                        |
| -------- | ---------------------------------------- | ----------------------------------- |
| What     | one concern name                         | a file list as the title            |
| Includes | logic + integration + surface this slice | “later: tests” / “later: UI”        |
| Test     | command + angles, or `N/A` + reason      | vague “add tests”                   |
| Surface  | action → expected on the product         | duplicate Test only                 |
| Notes    | `prerequisite:`, skip reason             | merge rationale for bundling slices |

Situation references on `work` (`goal-discover.md`, `build.md`) say how to fill **Test** / **Surface** — do not copy those rules here.

**Two rules — do not collapse them:**

1. **Concern order** — grow behavior thinly. Incomplete _breadth_ early is fine; incomplete _quality_ is not.
2. **Fidelity** — “draft” means _fewer concerns_, not fake data or sloppy soft output. No throwaway placeholders (`foo`, `lorem`).

**Avoid bundling:** full feature in one slice; horizontal cuts; merging slices because of a dependency (`prerequisite:` is a note, not a merge reason).

**Agree in chat per slice** (or the agenda as a whole) before execute. Issue body updates at milestones when needed — not after every slice by default.

## Rail

```text
Inventory → Slice table → User agrees → Execute → Commit
                                         → Issue update when needed
```

## Hard limits

- Do not execute before user agreement on the agenda or the next slice.
- Do not treat the Build issue as a durable list of slices — session slices stay in chat.
- Do not run this gate for `/chore` — harness leaves `unlock.agenda` null there.

Hand off to `work` / `scope` / `issue` / `rules` by name — do not copy their contents here.

---
name: agenda
description: >-
  Build a session agenda: inventory → thin vertical slices → user agreement before execute.
  Use when drafting or revising what to do next in slices (agent or user may start).
---

# agenda

Inventory → slice table → agree → then execute. Does not set session direction (`scope`) and does not edit files (`rules`).

## Steps

1. Read the matching situation ref: Goal/Discover → `references/goal-discover.md`; Build → `references/build.md`.
2. **Inventory** — short bullets from that ref. No sequence yet. Never invent from an empty list.
3. **Slice table** — thin vertical slices in chat (not on issues). One row = one verifiable concern.
4. Stop and wait for agreement (whole agenda or next slice). Do not start execute in the same turn as the first agenda dump.

## Format

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

Optional: `prerequisite: …` inside Includes.

- Concern order: grow thinly. Incomplete breadth early OK; incomplete quality not.
- Fidelity: “draft” = fewer concerns, not fake data. No `foo` / `lorem`.
- Avoid: full feature in one slice; horizontal cuts; merging slices for a dependency.

**Goal / Discover:** Includes = soft + `findings/` + issue/axis; Test = `N/A` unless product logic; Surface = artifact / axis update.  
**Build:** Includes = logic + wire + surface for this concern; Test / Surface → `references/build.md`.

## Limits

- Do not execute before agreement.
- Do not treat the Build issue as a durable slice list — slices stay in chat.

Hand off: caller (`work` / softs / `issue` / `rules` as needed).

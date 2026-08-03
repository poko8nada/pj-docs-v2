---
name: agenda
description: >-
  Builds an agreed context scan and slice/task plan so execution proceeds in verifiable units. Use when Goal / Discover / Build work needs sequencing or a chore has multiple steps or choices. Do not use for session focus, direct small edits, or edit guidance; it plans but does not edit.
---

# agenda

Context scan → slice/task table → agree → then execute. Does not set session direction (`scope`) and does not edit files (`rules`).

## Produces

- An agreed slice/task table with work, validation, and observable surface for each row.

## Steps

1. Read the matching situation ref:
   - Goal / Discover → `references/goal-discover.md`
   - Build → `references/build.md`
   - Chore → `references/chore.md`
2. **Context scan** — collect short bullets from that ref. No sequence yet. Never invent from an empty list.
3. **Slice/task table**:
   - Goal / Discover / Build → thin vertical slices in chat (not on issues).
   - Chore → the same slice/task model for one non-product or non-functional maintenance concern.
     One row = one verifiable concern or task.
4. Stop and wait for agreement (whole agenda or next slice). Do not start execute in the same turn as the first agenda dump.

## Format

```markdown
| #   | What        | Includes          | Test    | Surface         |
| --- | ----------- | ----------------- | ------- | --------------- |
| 1   | one concern | work + validation | cmd/N/A | observe outcome |
```

| Column   | Write                               | Do not write                 |
| -------- | ----------------------------------- | ---------------------------- |
| What     | one concern name                    | file list as the title       |
| Includes | relevant work + wiring + validation | “later: tests” / “later: UI” |
| Test     | command + angles, or `N/A` + reason | vague “add tests”            |
| Surface  | action → expected outcome           | duplicate Test only          |

Optional: `prerequisite: …` inside Includes.

- Concern order: grow thinly. Incomplete breadth early OK; incomplete quality not.
- Fidelity: “draft” = fewer concerns, not fake data. No `foo` / `lorem`.
- Avoid: full feature in one slice; horizontal cuts; merging slices for a dependency.

**Goal / Discover:** Includes = soft + `findings/` + issue/axis; Test = `N/A` unless product logic; Surface = artifact / axis update.  
**Build:** Includes = logic + wire + surface for this concern; Test / Surface → `references/build.md`.
**Chore:** Use the same slice/task table for one non-product or non-functional maintenance concern; Test = command or `N/A` with reason; Surface = expected harness, product-copy, or document outcome.

## Limits

- Do not execute before agreement.
- Do not treat the Build issue as a durable slice list — slices stay in chat.
- Chore mode does not create Goal / Discover / Build work, write Issues, or open a new gate.

## Handoff

Caller (`work` / `chore` / soft skills / `issue` / `rules` as needed).

---
name: memory
description: This allows you to save and retrieve reusable knowledge across sessions and project. Since both successes and failures are essential for your growth, be sure to use this skill proactively.
---

# Memory

## Location

- Memory root: `~/.cursor/memories/`. This is global root.

## When to use

Use this skill in the following situations:

- When you want to remember, save, or take notes on something
- When you want to recall past decisions or research findings
- When you want to organize or tidy up old notes

Also, be sure to make active use of this skill whenever you come across knowledge worth preserving:

- Decisions or their rationale that aren’t immediately clear
- Complex troubleshooting methods or pitfalls
- Research findings obtained through significant effort

If you remember, increase the `timesRemembered` field.
If you update, increase the `timesUpdated` field.

## File format

- Store each memory as Markdown with frontmatter:
  ```yaml
  ---
  summary: "1-2 lines: what this memory contains and why it matters"
  created: YYYY-MM-DD
  updated: YYYY-MM-DD
  timesRemembered: 1 # increment this every time you recall this memory
  timesUpdated: 1 # increment this every time you update this memory
  ---
  ```
- File name is kebab-case of `YYYYMMDD-summary`.
- Contents are within 200 lines. also, must be in Japanese.

## Search workflow

```bash
# list summaries quickly
rg "^summary:" ~/.cursor/memories/ --no-ignore --hidden

# filter by keyword
rg "^summary:.*keyword" ~/.cursor/memories/ --no-ignore --hidden -i
```

## Quality guidelines

- Write for future resumption (context, state, next step).
- Keep summaries decisive.
- Update stale notes or remove obsolete ones.

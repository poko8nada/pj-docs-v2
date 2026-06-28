---
name: trace
description: "Organize recent discussion topics into a chronological table when the conversation has drifted, jumped between topics, or needs a quick overview of what was discussed. Trigger proactively when multiple threads tangle or when the user asks for a recap. Not a checkpoint before actions — a mid-session orientation tool."
---

# trace

When the session has jumped between topics or lost its thread, list the recent discussion topics in chronological order. Each row is one topic, summarized in one line.

## When to trigger

- The conversation has drifted from the original Goal
- Multiple threads are tangled
- The user asks for a recap or "what did we discuss"
- The agent itself is uncertain about what was just discussed

## Output format

```markdown
# [Topic]

## Topics

| #   | Topic               | Summary          | Status |
| --- | ------------------- | ---------------- | ------ |
| 1   | [first topic title] | [1-line summary] | close  |
| 2   | [next topic title]  | [1-line summary] | open   |
| 3   | [next topic title]  | [1-line summary] | close  |

( ... continue until the most recent topic )
```

## Column meanings

1. **#** — chronological order (1 is the oldest, last is the most recent)
2. **Topic** — short title of the discussion
3. **Summary** — 1-line summary of what was discussed or decided
4. **Status** — `open` (still in progress or unresolved) / `close` (resolved or moved past)

## Usage

- Read the recent conversation and identify topic boundaries
- Include all distinct topics, not just the current one
- Be concise — 1 line per topic
- Mark the current/most recent topic with the appropriate status

## After showing

Briefly note which topic is currently active and what to discuss next. Do not force the user to confirm unless they asked for a recap.

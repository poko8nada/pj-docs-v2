---
name: trace
description: "Organize the session into a structured handoff. Captures current state, key decisions with rationale, discussion topics, and next steps. Use when the conversation is long, context is fragmented, or a clear picture of where things stand is needed."
---

# trace

Capture the full session picture in one structured output. Surface what lives in the model's working memory but isn't durable in chat history.

## Why this matters

Some context is fragile. It exists in the model's current reasoning state but is not explicitly recorded in the conversation:

- **Reasoning / thinking** — the chain of thought that led to a decision. Lost when switching from a thinking model, or when the prefix cache is invalidated.
- **Implicit assumptions** — things the model inferred from context but never stated. A new model (or the same model after context compaction) won't have them.
- **Trade-off rationale** — why approach A was chosen over B. The chat may show the outcome but not the rejected alternatives.
- **Unwritten conventions** — patterns the model noticed in the codebase and followed without documenting.

Surfacing these makes the session resilient — whether you switch models, hit compaction, or just want a clear picture of where things stand.

## When to trigger

- The conversation has drifted or multiple threads are tangled
- The session is long and context may be fragmented
- The user asks for a recap
- The agent senses it may lose track of the full picture
- Before a phase transition or context reset

## Output format

```markdown
# Session Trace

## Current State

- Phase: {current phase}
- Active issue: {#N title} (if any)
- What's been built: {1-line summary of implemented changes}
- Gate status: {skills loaded, triggers}

## Key Decisions

| Decision           | Rationale                                                 |
| ------------------ | --------------------------------------------------------- |
| {what was decided} | {why — the reasoning that led here, not just the outcome} |

Include decisions where the rationale may not be obvious from chat history alone. Capture the "why" that lives in the model's thinking.

## Topics

| #   | Topic         | Summary          | Status |
| --- | ------------- | ---------------- | ------ |
| 1   | {first topic} | {1-line summary} | close  |
| 2   | {next topic}  | {1-line summary} | open   |

## Next

- {pending action or open question}
- {what needs attention next}

## Context Notes

{anything the current model understands from context that a fresh reader might miss — implicit assumptions, unwritten conventions, nuances from earlier discussion}
```

## Usage

- Read the recent conversation and identify topic boundaries
- Extract key decisions — especially those where the reasoning was discussed but may not be explicitly recorded
- The Context Notes section is the most important for handoff: surface implicit knowledge
- Be concise — 1 line per item
- Mark topics with `open` or `close`

## After showing

Briefly note which topic is currently active. Do not force the user to confirm unless they asked for a recap.

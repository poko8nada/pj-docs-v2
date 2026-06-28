---
description: Resume a previous session — restore context and re-present the plan
---

[session-resume]

The current session has been resumed after a restart. Your in-memory state (execution gate) has been reset, but the chat history is intact in context.

## Your task

1. **Summarize the current topic.** Review the chat history and provide a concise summary of what was being discussed and what decisions were made.

2. **Re-present the plan.** If a plan was agreed upon in the plan skill, re-display it here using the format below. If no plan exists, state that clearly.

### Plan format

The plan tool submits only a minimal JSON payload (`{ type, fileChanges }`). All plan content lives in the Markdown output. Re-present the plan using this MD format:

```markdown
### What

[Implementation scope, main path + error cases]

### How (optional)

[Structural approach]

### Order & Verify

**Slice 1: <one-line description>**

- Test: `<test command>` or `N/A` (per Test policy)
- App: `<app command>` → <what user does> → <expected outcome>

**Slice 2: <one-line description>**

- Test: ...
- App: ...

### File changes

| Path              | Type            | Detail       |
| ----------------- | --------------- | ------------ |
| `path/to/file.ts` | new/edit/delete | what changes |

### Rationale

[Why this plan, evidence from research + Phase 1 codebase comparison]
```

## After this

The user will tell you which execution skill to use (implement, debug, etc.). Wait for their instruction.

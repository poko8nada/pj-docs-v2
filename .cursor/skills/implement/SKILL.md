---
name: implement
description: Use when the user shares code containing empty functions, TODOs, stubs, or placeholder comments and asks to fill in the implementation. Trigger on phrases like "flesh this out", "complete this", "implement this", "fill in the blanks", "implement within this skeleton", or whenever pasted code clearly has missing logic that needs to be written. Always use this skill rather than implementing ad hoc when skeleton code is present.
---

# Implement

Fill in the implementation of a code skeleton provided by the user.

## Preparation

- Reload `.cursor/rules/project-meta.mdc` and incorporate it into the signal for this skill execution.
- Gain a comprehensive understanding of the project, not just the scope that was requested.

## Steps

1. **Clarify only if behavior is truly ambiguous.** If the intent is obvious from the skeleton, skip this step.

2. **Fill in the implementation:**
   - Do not change function signatures
   - Do not change the file structure
   - Do not create new files unless explicitly instructed
   - Do not add abstractions or utilities not suggested in the skeleton

3. **At each logical breakpoint**, add the comment:

   > `// Functionality can be verified up to this point`

   Use this whenever a self-contained unit (e.g., a function or a group of related functions) is complete and independently testable.

4. **Point out design issues** in the skeleton if any are found. However, unless otherwise instructed, implement it exactly as described — do not silently deviate.

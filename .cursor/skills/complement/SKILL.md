---
name: complement
description: Use when user ask about code and you fill in the details (user ask such as "flesh this out, "complete this" or "implement this within skeleton"). Or when you as the tech lead, paste a skeleton containing empty functions or TODOs for help user.
---

# Complement

## Preparation

- Gain a comprehensive understanding of the project, not just the scope that was requested.

### When User Asks

1.  Ask questions only if the behavior is unclear. If the intent is obvious, skip this step.

2.  Fill in the implementation:
    - Do not change the signatures
    - Do not change the file structure
    - Do not create new files unless explicitly instructed to do so

3.  At each logical breakpoint, add a note "Functionality can be verified up to this point" if applicable.
    - If there are design issues with the skeleton, point them out. However, unless otherwise instructed, implement it exactly as described.
    - Do not add any abstractions or utilities not suggested in the skeleton.

### As Tech Lead

1. Provide a skeleton to fill in the implementation.
   - This includes empty functions and TODO entries.

2. In the chat, clearly state "what”is needed, "why" it is needed, and what the “Happy Path” is.

3. When providing a skeleton, avoid the following:
   - Unnecessary details
   - Changes that are out of context
   - Ignoring best practices

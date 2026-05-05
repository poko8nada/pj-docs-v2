---
name: scaffold
description: Use when acting as tech lead to design a code skeleton for the user to implement. Trigger when the user asks to "design the structure", "give me a skeleton", "outline the implementation", "set up the scaffolding", or when Claude needs to delegate implementation details to the user. Always use this skill rather than providing a full implementation when the goal is to hand off the coding work.
---

# Scaffold

Act as tech lead and provide a code skeleton for the user to implement.

## Preparation

- Reload `.opencode/rules/project-meta.mdc` and incorporate it into the signal for this skill execution.
- Gain a comprehensive understanding of the project, not just the scope that was requested.

## Steps

1. **Design the skeleton:**
   - Provide empty functions and TODO entries at the right level of granularity
   - Keep function signatures clear and intentional — they are the contract the user will implement against
   - Do not add unnecessary details or changes out of context
   - Follow best practices for the language/framework in use

2. **In the chat, clearly state for each major component:**
   - **What** — what this piece does
   - **Why** — why it's needed / the design decision behind it
   - **Happy Path** — the expected flow when everything works correctly

3. **Keep the skeleton focused:**
   - Avoid over-specifying implementation details inside the skeleton itself
   - Leave room for the user to make reasonable implementation choices
   - If there are meaningful design trade-offs, call them out explicitly rather than silently baking in one option

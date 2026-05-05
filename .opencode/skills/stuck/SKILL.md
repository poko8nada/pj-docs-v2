---
name: stuck
description: Use when user says "I'm stuck", "I don't understand", "What should I do ?" or "I can't move forward". Or when user report errors and bugs. Before replying, identify the type of issue.
---

# Stuck

## Preparation

- Reload `.opencode/rules/project-meta.mdc` and incorporate it into the signal for this skill execution.
- Gain a comprehensive understanding of the project, not just the scope that was requested.

## Blockage Types

| Type                | Signal                                           | Response                      |
| ------------------- | ------------------------------------------------ | ----------------------------- |
| Error or Bugs       | Stack trace, unexpected output, Bugs occer       | 1 cause, 1 fix, how to verify |
| Design or Functions | "Which way should I go?", "How should I design?" | 2 options, 1 tradeoff each    |
| Blank page          | "Where should I start?", no code yet             | visible vertical slice        |

Especially for Blank, you should give advices with a clear understanding of the context.  
If need more info, discuss with user.

## Instructions

- Gain a comprehensive understanding of the project, not just the scope that was requested.
- Never offer more than one solution path at a time.
- Depending on the situation, Load the `complement skill` to intervene.

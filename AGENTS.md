# AGENTS.md

Good context leads to good work. Context is built through user discussion, maintained gitHub issues, and 'English' code w/ 'Japanese' comments.

## Principles

Follow these principles to build and maintain good context.

1. Proactive — Analyze context and propose before asking the user.
2. Research — Best practice first. Offical Docs, Reliable sources and Community consensus, NOT your own opinion.
3. Agreement — Act only with user approval. No silent scope changes.
4. Incremental — Build the smallest unit, get approval, then expand.
5. Verifiability — Make verification clear. The user should never wonder what changed.

## Language style

- English to think, Japanese to speak — token efficiency without losing human touch.
- Also, code in English, comments in Japanese. ー Good balance for Japanese developers.

## Meta

- The harness is monitoring, so if it gets blocked, follow the rules in the error message.
- Actively utilize the subagents built into the system.
  - `general`: Simple tasks, repetitive or parallel tasks
  - `explore`: Scanning the codebase, external research
- Use pnpm for all package management.

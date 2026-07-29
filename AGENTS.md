# AGENTS.md

Deliver high-quality results by building up **high-quality context** through discussion and agreement with the user.

## Principles

### What constitutes context

Do your best to ensure that you can learn about the project's status, direction, and future plans.

1. Discussions via chat with the user.
2. Well-maintained documentation, such as GitHub issues.
3. Structured code using English and Japanese comments that convey information.

### Enhancing high-quality

1. Chat explanations must be **logical and concise**. Limit options to standard, non-hacky approaches; keep the number of choices to a minimum and refine them.
2. Documentation must be actively maintained. Propose updates whenever you deem them necessary, even during a session.
3. Code must be self-explanatory through its structure. Actively supplement the code using Japanese comments. However, do not leave discarded information or outdated context in the documentation or code unless it is necessary to explain the rationale behind a change.

### Agreement with the user

1. You are **NOT permitted** to advance the workflow or write code without the user's agreement.
2. Agreement requires explicit confirmation; do not assume it is self-evident. Always take the initiative to secure the user's agreement.

## Language Style

- Think in English and speak in Japanese—Strive to improve token efficiency without sacrificing a natural, human-like tone.
- Code should be in English, and comments in Japanese. Additionally, documentation for agents should be in English, while documentation for users should be in Japanese.

## Meta

- The harness is monitoring, so if it gets blocked, **MUST** follow the rules in the error message.
- Use pnpm for all package management.

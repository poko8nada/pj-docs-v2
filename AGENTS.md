# AGENTS.md

Deliver high-quality results by building up **high-quality context** through discussion and agreement with the user.

## Principles

### What constitutes context

1. Discussions via chat with the user.
2. Well-maintained documentation, such as GitHub issues.
3. Structured code using English and Japanese comments that convey information.

Use these contexts to help you constantly examine and grasp the context, and **to think through your next move**.

### Enhancing high-quality

1. Keep explanations **as concise as possible**, maintain a logical structure, and always focus on the key points.
2. **Limit options** to standard, non-hacky approaches; keep the number of choices to a minimum and refine them.
3. Documentation must be actively maintained. Propose updates whenever you deem them necessary, even during a session.
4. Code must be **self-explanatory** through its structure. Actively supplement the code using Japanese comments.
5. However, do NOT leave discarded information or outdated context in the documentation or code unless it is necessary to explain the rationale behind a change.

### Agreement with the user

1. You are **NOT permitted** to advance the workflow or write code without the user's agreement.
2. Agreement requires explicit confirmation; do not assume it is self-evident. Always take the initiative to secure the user's agreement.

## Language style

- Think in English and speak in Japanese—Strive to improve token efficiency without sacrificing a natural, human-like tone.
- Code should be in English, and comments in Japanese. Additionally, documentation for agents should be in English, while documentation for users should be in Japanese.

## Meta

- The harness is monitoring, so if it gets blocked, **MUST** follow the rules in the error message.
- Use pnpm for all package management.

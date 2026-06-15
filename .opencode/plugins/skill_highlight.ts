// @ts-nocheck
import type { Plugin } from '@opencode-ai/plugin';

// Skills that should trigger a chat-side highlight on completion.
const HIGHLIGHT_SKILLS = new Set(['memory', 'implement', 'debug', 'apply-pattern', 'issue']);

const HIGHLIGHT_REMINDER = `
## Skill Completion Highlight

A tracked skill just completed. Output a chat-side highlight now, in the SAME response, with these sections:

- **What changed** — what was modified, created, or observed
- **How it changed** — structural diff (counts, file paths, decisions)
- **What did not change** — what was checked but left as-is (so the user knows the skill looked but did not act)
- **Verify** — when files were created or modified, list what was verified (lint, typecheck, test, manual check, or not verified). If nothing was modified, omit this section.

Ground every claim in actual tool output. Do not invent changes that did not happen. If a section would be empty, omit it.

Output the highlight at the END of your response, after any other content.
`.trim();

export const SkillHighlightPlugin: Plugin = async () => {
  // sessionID -> skill name waiting to be announced
  const pending = new Map<string, string>();

  return {
    'tool.execute.after': async (input) => {
      if (input.tool !== 'skill') return;

      const args = input.args as { name?: string } | undefined;
      const skillName = args?.name;
      if (!skillName || !HIGHLIGHT_SKILLS.has(skillName)) return;

      pending.set(input.sessionID, skillName);
    },

    'experimental.chat.system.transform': async (input, output) => {
      const sessionID = input.sessionID;
      if (!sessionID) return;

      const skillName = pending.get(sessionID);
      if (!skillName) return;

      // Consume once — next LLM call in this session will not see it.
      pending.delete(sessionID);

      output.system.push(`[Skill: ${skillName} completed]\n\n${HIGHLIGHT_REMINDER}`);
    },
  };
};

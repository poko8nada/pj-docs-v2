import type { Plugin } from '@opencode-ai/plugin';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

export const AgentsReminderPlugin: Plugin = async ({ directory }) => {
  const agentsPath = join(directory, 'AGENTS.md');
  const hasAgentsMd = existsSync(agentsPath);

  const agentsMd = hasAgentsMd ? readFileSync(agentsPath, 'utf-8').trim() : '';

  const reminders = [
    `<important>
  STOP. Before touching any file, tell the user in one sentence what you plan to do. Wait for approval.
  If you skip any step above and act unilaterally, STOP immediately, revert what you did, and restart from Step 1.
  </important>`,

    `<important>
  HALT. What are you about to do? Say it out loud to the user first. Do not act until they confirm.
  Acting without approval is a critical failure. If you already did — stop, apologize, and restart.
  </important>`,

    `<important>
  Do NOT act yet. State your plan in one sentence. Wait for the user to say "go ahead" or equivalent.
  If you feel the urge to "just do it quickly" — that urge is wrong. Stop. Follow the steps.
  </important>`,
  ];

  let count = 0;

  return {
    'chat.message': async (input, output) => {
      if (!hasAgentsMd) return;

      // @ts-ignore
      const firstPart = output.parts.find((p) => p.type === 'text' && !(p as unknown).synthetic);
      if (!firstPart || firstPart.type !== 'text') return;

      const isDoubleLine = firstPart.text.startsWith('\n\n');
      const isSingleLine = firstPart.text.startsWith('\n');

      if (!isSingleLine) return;

      const reminder = reminders[count % reminders.length];
      count++;

      const text = isDoubleLine
        ? `${reminder}\n\n---\n\n# AGENTS.md\n\n${agentsMd}\n\n---`
        : `${reminder}\n\n---`;

      output.parts.unshift({
        type: 'text',
        id: crypto.randomUUID(),
        sessionID: input.sessionID,
        messageID: input.messageID ?? '',
        text,
      });
    },
  };
};

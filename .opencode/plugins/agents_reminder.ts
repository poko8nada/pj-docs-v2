import type { Plugin } from '@opencode-ai/plugin';
import { existsSync } from 'fs';
import { join } from 'path';

export const AgentsReminderPlugin: Plugin = async ({ directory }) => {
  const agentsPath = join(directory, 'agents.md');
  const hasAgentsMd = existsSync(agentsPath);

  const reminder = `<important>
    Read agents.md NOW and follow every instruction in it. Because you often forget to discuss first.
    And also you everytime forget to try to load skills that is related to the topic.
  </important>`.trim();

  return {
    'chat.message': async (input, output) => {
      if (!hasAgentsMd) return;

      const firstPart = output.parts.find((p) => p.type === 'text');
      if (!firstPart || !('text' in firstPart)) return;

      // 1行目が空行でなければスキップ
      if (!firstPart.text.startsWith('\n')) return;

      output.parts.unshift({
        type: 'text',
        id: crypto.randomUUID(),
        sessionID: input.sessionID,
        messageID: input.messageID ?? '',
        text: `${reminder}\n---`,
      });
    },
  };
};

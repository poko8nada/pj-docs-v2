//@ts-nocheck
import type { Plugin } from '@opencode-ai/plugin';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

export const AgentsReminderPlugin: Plugin = async ({ directory }) => {
  // AGENTS.md
  const agentsPath = join(directory, 'AGENTS.md');
  const agentsMd = existsSync(agentsPath) ? readFileSync(agentsPath, 'utf-8').trim() : '';

  // project-meta.mdc
  const metaPath = join(directory, '.opencode', 'rules', 'project-meta.mdc');
  const projectMeta = existsSync(metaPath) ? readFileSync(metaPath, 'utf-8').trim() : '';

  // ── 共通 ────────────────────────────────────────────────────────────────────

  const commonReminders = [
    `/build-awareness
<important>STOP. Run the skill now before doing anything else.</important>`,
    `/build-awareness
<important>HALT. Before anything else, run the skill.</important>`,
    `/build-awareness
<important>Do NOT act yet. Run the skill first.</important>`,
  ];

  // ── エージェント別 ───────────────────────────────────────────────────────────

  const agentReminders: Record<string, string[]> = {
    build: [
      `<important>When implementing, use the appropriate skill: /implement-ui, /implement-logic, /implement-state, /implement-api, /implement-db, /implement-test, /implement-config, or /debug. Use the question tool at every agreement point. No exceptions.</important>`,
      `<important>Never implement without running the appropriate implement-* or debug skill. Always use the question tool to confirm with the user before proceeding.</important>`,
      `<important>Use the question tool at Agreement Point 1 (plan) and Agreement Point 2 (result). Skipping either is not allowed.</important>`,
    ],
    pair: [
      `<important>You are a PAIR PROGRAMMING PARTNER. You do NOT write or suggest code directly. The user writes the code. Your job is to discuss, question, and review only. Use the question tool to think out loud WITH the user, not FOR the user.</important>`,
      `<important>Do NOT produce implementation-ready code. Discuss approaches, tradeoffs, and alternatives using the question tool. Let the user decide and implement.</important>`,
      `<important>Your role is to ask, not to do. Use the question tool to guide the user's thinking, not to replace it.</important>`,
    ],
  };

  const counts: Record<string, number> = {};

  const getCount = (agent: string) => {
    counts[agent] ??= 0;
    return counts[agent]++;
  };

  // ── plugin ───────────────────────────────────────────────────────────────────

  return {
    'chat.message': async (input, output) => {
      if (!existsSync(agentsPath)) return;

      const firstPart = output.parts.find((p) => p.type === 'text' && !(p as unknown).synthetic);
      if (!firstPart || firstPart.type !== 'text') return;

      const isTripleLine = firstPart.text.startsWith('\n\n\n');
      const isDoubleLine = firstPart.text.startsWith('\n\n');
      const isSingleLine = firstPart.text.startsWith('\n');
      if (!isSingleLine) return;

      const agent = (input as unknown).agent ?? 'build';
      const count = getCount(agent);

      const common = commonReminders[count % commonReminders.length];
      const specific = agentReminders[agent]?.[count % (agentReminders[agent]?.length ?? 1)] ?? '';

      const reminder = [common, specific].filter(Boolean).join('\n');

      const text = isTripleLine
        ? `${reminder}\n\n---\n\n# AGENTS.md\n\n${agentsMd}\n\n---\n\n# Project Guidelines\n\n${projectMeta}\n\n---`
        : isDoubleLine
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

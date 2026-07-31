/**
 * work の実装前ハンドシェイク。
 * agenda スキル実行（SKILL.md Read 検知）→ unlock.agenda: true。
 * discussion / chore では unlock.agenda は null（ゲート対象外）。
 */
import { formatDeny } from './deny-format.mjs';
import { isSpecFlowPhase } from './state.mjs';

export const AGENDA_SKILL_REL = '.cursor/skills/agenda/SKILL.md';

/** work 以外はゲート対象外（true = チェックしない） */
export function isAgendaReady(state) {
  if (!isSpecFlowPhase(state?.phase)) return true;
  return state?.unlock?.agenda === true;
}

/** @param {{ phase?: string, unlock?: { agenda?: boolean | null } }} state */
export function denyAgendaMessage(state) {
  if (!isSpecFlowPhase(state?.phase)) {
    return formatDeny({
      tag: 'gate-agenda',
      why: 'Agenda gate invoked in an unexpected phase.',
      next: ['Stay in `/work` for product edits that need agenda.'],
    });
  }
  return formatDeny({
    tag: 'gate-agenda',
    why: 'unlock.agenda is not true (work product edits require an agreed agenda).',
    next: [
      `Read \`${AGENDA_SKILL_REL}\` (opens unlock.agenda).`,
      'Build inventory → slice table; get user agreement before execute.',
      'Retry the edit only after that.',
    ],
  });
}

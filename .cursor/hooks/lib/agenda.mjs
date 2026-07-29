/**
 * work の実装前ハンドシェイク。
 * agenda スキル実行（SKILL.md Read 検知）→ unlock.agenda: true。
 * discussion / chore では unlock.agenda は null（ゲート対象外）。
 */
import { isSpecFlowPhase } from './state.mjs';

export const AGENDA_SKILL_REL = '.cursor/skills/agenda/SKILL.md';

/** work 以外はゲート対象外（true = チェックしない） */
export function isAgendaReady(state) {
  if (!isSpecFlowPhase(state?.phase)) return true;
  return state?.unlock?.agenda === true;
}

/** @param {{ phase?: string, unlock?: { agenda?: boolean | null } }} state */
export function denyAgendaMessage(state) {
  if (!isSpecFlowPhase(state?.phase)) return '[gate-agenda] unexpected phase';
  return (
    `[gate-agenda] Before product edits in work, run \`${AGENDA_SKILL_REL}\` ` +
    `(build the agenda and get user agreement before execute).`
  );
}

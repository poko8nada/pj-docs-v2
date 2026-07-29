/**
 * work の実装前ハンドシェイク。
 * agenda/SKILL.md Read → unlock.agenda: true。
 * discussion / chore では unlock.agenda は null（ゲート対象外）。
 */
import { SPEC_FLOW_PHASES } from './state.mjs';

export const AGENDA_SKILL_REL = '.cursor/skills/agenda/SKILL.md';

export function isSpecFlowPhase(phase) {
  return SPEC_FLOW_PHASES.has(phase);
}

/** work 以外はゲート対象外（true = チェックしない） */
export function isAgendaReady(state) {
  if (!isSpecFlowPhase(state?.phase)) return true;
  return state?.unlock?.agenda === true;
}

/** @param {{ phase?: string, unlock?: { agenda?: boolean | null } }} state */
export function denyAgendaMessage(state) {
  if (!isSpecFlowPhase(state?.phase)) return '[gate-agenda] unexpected phase';
  return (
    `[gate-agenda] Before product edits in work, Read \`${AGENDA_SKILL_REL}\` ` +
    `(build the agenda and get user agreement before execute).`
  );
}

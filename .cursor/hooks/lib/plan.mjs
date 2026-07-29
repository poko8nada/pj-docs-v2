/**
 * work の実装前ハンドシェイク。
 * plan/SKILL.md Read → unlock.plan: true。
 * discussion / chore では unlock.plan は null（ゲート対象外）。
 */
import { SPEC_FLOW_PHASES } from './state.mjs';

export const PLAN_SKILL_REL = '.cursor/skills/plan/SKILL.md';

export function isSpecFlowPhase(phase) {
  return SPEC_FLOW_PHASES.has(phase);
}

/** work 以外はゲート対象外（true = チェックしない） */
export function isPlanReady(state) {
  if (!isSpecFlowPhase(state?.phase)) return true;
  return state?.unlock?.plan === true;
}

/** @param {{ phase?: string, unlock?: { plan?: boolean | null } }} state */
export function denyPlanMessage(state) {
  if (!isSpecFlowPhase(state?.phase)) return '[gate-plan] unexpected phase';
  return (
    `[gate-plan] Before product edits in work, Read \`${PLAN_SKILL_REL}\` ` +
    `(build the plan and get user agreement before execute).`
  );
}

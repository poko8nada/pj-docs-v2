/**
 * mentor レイヤー — 会話 state の mentor フラグ + stub のターン局所 sticky。
 * stub は mentor ON のときだけ有効（OFF では track が sticky を立てない＝ハーネス no-op）。
 */
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { isReviewablePath } from './_review.mjs';
import { formatJstIso, isUnknownConversationId, stateDir } from './_state.mjs';

export const LAST_STUB_FILENAME = 'last-stub';

export const DENY_MENTOR =
  '[gate-mentor] Code edits blocked while `/mentor` is on. User sends `/stub` for one turn, or `/mentor off` to leave mentor.';

export function lastStubPath(root) {
  return join(stateDir(root), LAST_STUB_FILENAME);
}

/** 会話 state 上の mentor が ON か */
export function isMentorActive(state) {
  return state?.mentor === true;
}

/** 直前発話で立てた stub sticky を消す（次発話の beforeSubmitPrompt 冒頭） */
export function clearStubTurn(root) {
  try {
    unlinkSync(lastStubPath(root));
  } catch {
    // 無ければ無視
  }
}

/**
 * stub sticky を立てる。mentor OFF 時の no-op は呼び出し側（track）が保証する。
 */
export function enableStubTurn(root, id) {
  if (isUnknownConversationId(id)) return false;
  const dir = stateDir(root);
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    lastStubPath(root),
    `${JSON.stringify({ id: String(id), updatedAt: formatJstIso() }, null, 2)}\n`,
    'utf8',
  );
  return true;
}

/** この会話の「今ターン」stub が有効か */
export function isStubTurnActive(root, id) {
  if (isUnknownConversationId(id)) return false;
  try {
    if (!existsSync(lastStubPath(root))) return false;
    const raw = JSON.parse(readFileSync(lastStubPath(root), 'utf8'));
    return typeof raw?.id === 'string' && raw.id === String(id);
  } catch {
    return false;
  }
}

/**
 * mentor ON かつ stub 無し → コード編集を止めるべきか。
 * bootstrap より下・通常 gate より上で使う。
 */
export function isMentorCodeBlocked(root, state, id) {
  if (!isMentorActive(state)) return false;
  if (isStubTurnActive(root, id)) return false;
  return true;
}

/** Write 対象 path が mentor のコード deny 対象か */
export function isMentorDeniedPath(root, state, id, filePath) {
  if (!isMentorCodeBlocked(root, state, id)) return false;
  if (!filePath) return false;
  return isReviewablePath(root, String(filePath));
}

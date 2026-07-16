/**
 * ゲート用セッション state
 * ファイル名: `YYYYMMDD-HHmmss+0900__<conversation_id>.json`（JST・日付順ソート）
 * conversation 単位で残す（resume 用）。古いファイルは TTL で掃除。
 * テスト時は CURSOR_GATE_STATE_DIR で置き場を上書きする。
 */
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { basename, dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const hooksDir = fileURLToPath(new URL('.', import.meta.url));
const projectRootFallback = resolve(hooksDir, '../..');

/** 既定フェーズ（議論・調査のみ。コード不可） */
export const PHASE_DISCUSSION = 'discussion';

export const WORK_PHASES = new Set(['spec', 'design', 'forge', 'refine', 'chore']);

/** 最終更新からこの日数を超えた state を削除 */
export const STATE_TTL_DAYS = 7;

const STATE_TTL_MS = STATE_TTL_DAYS * 24 * 60 * 60 * 1000;
const JST = 'Asia/Tokyo';

export function workspaceRoot(payload) {
  const roots = payload?.workspace_roots;
  if (Array.isArray(roots) && roots[0]) return resolve(roots[0]);
  if (payload?.cwd) return resolve(payload.cwd);
  return projectRootFallback;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** transcript パスから conversation UUID を抽出 */
export function idFromTranscriptPath(transcriptPath) {
  if (!transcriptPath || typeof transcriptPath !== 'string') return null;
  const stem = basename(transcriptPath, '.jsonl');
  if (UUID_RE.test(stem)) return stem;
  const parent = basename(dirname(transcriptPath));
  if (UUID_RE.test(parent)) return parent;
  return null;
}

/** sessionStart が返す env（公式: セッション中の後続 hook へ伝播） */
export const GATE_CONVERSATION_ENV = 'CURSOR_GATE_CONVERSATION_ID';

export function conversationId(payload) {
  if (payload?.conversation_id) return String(payload.conversation_id);
  if (payload?.session_id) return String(payload.session_id);
  const fromPayload = idFromTranscriptPath(payload?.transcript_path);
  if (fromPayload) return fromPayload;
  const fromTranscriptEnv = idFromTranscriptPath(process.env.CURSOR_TRANSCRIPT_PATH);
  if (fromTranscriptEnv) return fromTranscriptEnv;
  const fromGateEnv = process.env[GATE_CONVERSATION_ENV];
  if (fromGateEnv && fromGateEnv !== 'unknown') return String(fromGateEnv);
  return 'unknown';
}

export function stateDir(root) {
  if (process.env.CURSOR_GATE_STATE_DIR) return resolve(process.env.CURSOR_GATE_STATE_DIR);
  return join(root, '.cursor/hooks/state');
}

/** ファイル名用に id を安全化 */
export function sanitizeConversationId(id) {
  return String(id).replace(/[^a-zA-Z0-9._-]+/g, '_') || 'unknown';
}

/** JST のソート可能なスタンプ: 20260716-133045+0900 */
export function formatJstFileStamp(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: JST,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const get = (type) => parts.find((p) => p.type === type)?.value ?? '00';
  return `${get('year')}${get('month')}${get('day')}-${get('hour')}${get('minute')}${get('second')}+0900`;
}

/** JST の ISO 風: 2026-07-16T13:30:45+09:00 */
export function formatJstIso(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: JST,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const get = (type) => parts.find((p) => p.type === type)?.value ?? '00';
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}:${get('second')}+09:00`;
}

function idSuffix(id) {
  return `__${sanitizeConversationId(id)}.json`;
}

/**
 * 既存ファイル名を探す。形式は `YYYYMMDD-HHmmss+0900__<id>.json` のみ。
 * 同一 id が複数あれば辞書順末尾（＝新しいスタンプ側）を使う。
 */
export function findStateFileName(root, id) {
  const dir = stateDir(root);
  if (!existsSync(dir)) return null;
  const suffix = idSuffix(id);
  const matches = readdirSync(dir)
    .filter((n) => n.endsWith(suffix))
    .toSorted();
  if (matches.length === 0) return null;
  return matches[matches.length - 1];
}

/** 新規作成用パス（既存があればそのパス） */
export function statePath(root, id) {
  const name = findStateFileName(root, id);
  if (name) return join(stateDir(root), name);
  return join(stateDir(root), `${formatJstFileStamp()}__${sanitizeConversationId(id)}.json`);
}

/** エージェント向け: 既存があれば実名、未作成なら glob ヒント */
export function statePathRelative(root, id) {
  const name = findStateFileName(root, id);
  if (name) return `.cursor/hooks/state/${name}`;
  return `.cursor/hooks/state/*__${sanitizeConversationId(id)}.json`;
}

/** @returns {{ required: boolean, done: boolean, files: string[] }} */
export function defaultReview() {
  return { required: false, done: true, files: [] };
}

/** @returns {{ pending: string[] }} */
export function defaultCheck() {
  return { pending: [] };
}

export function normalizeCheck(check) {
  if (!check || typeof check !== 'object') return defaultCheck();
  const pending = Array.isArray(check.pending)
    ? [...new Set(check.pending.map((f) => String(f)).filter(Boolean))]
    : [];
  return { pending };
}

export function normalizeReview(review) {
  if (!review || typeof review !== 'object') return defaultReview();
  const files = Array.isArray(review.files)
    ? [...new Set(review.files.map((f) => String(f)).filter(Boolean))]
    : [];
  const required = review.required === true;
  let done;
  if (typeof review.done === 'boolean') {
    done = review.done;
  } else if (typeof review.cleared === 'boolean') {
    done = review.cleared;
  } else {
    done = !required;
  }
  return { required, done, files };
}

/** @returns {{ phase: string, implement: boolean | null, review: ReturnType<typeof defaultReview>, check: ReturnType<typeof defaultCheck>, updatedAt: string }} */
export function defaultState() {
  return {
    phase: PHASE_DISCUSSION,
    implement: null,
    review: defaultReview(),
    check: defaultCheck(),
    updatedAt: formatJstIso(),
  };
}

function normalizePhase(phase) {
  if (phase === PHASE_DISCUSSION || WORK_PHASES.has(phase)) return phase;
  return PHASE_DISCUSSION;
}

/** discussion → null。作業フェーズ → true/false のみ */
export function normalizeImplement(phase, implement) {
  const p = normalizePhase(phase);
  if (p === PHASE_DISCUSSION) return null;
  return implement === true;
}

export function loadState(root, id) {
  const name = findStateFileName(root, id);
  if (!name) return defaultState();
  try {
    const raw = JSON.parse(readFileSync(join(stateDir(root), name), 'utf8'));
    const phase = normalizePhase(typeof raw.phase === 'string' ? raw.phase : PHASE_DISCUSSION);
    return {
      phase,
      implement: normalizeImplement(phase, raw.implement),
      review: normalizeReview(raw.review),
      check: normalizeCheck(raw.check),
      updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : defaultState().updatedAt,
    };
  } catch {
    return defaultState();
  }
}

export function saveState(root, id, state) {
  const dir = stateDir(root);
  mkdirSync(dir, { recursive: true });
  const path = statePath(root, id);
  const prev = loadState(root, id);
  const phase = normalizePhase(state.phase ?? prev.phase);
  const next = {
    phase,
    implement: normalizeImplement(phase, state.implement ?? prev.implement),
    review: normalizeReview(state.review ?? prev.review),
    check: normalizeCheck(state.check ?? prev.check),
    updatedAt: formatJstIso(),
  };
  writeFileSync(path, JSON.stringify(next, null, 2) + '\n', 'utf8');
  return next;
}

export function isReviewBlocking(state) {
  const review = normalizeReview(state?.review);
  return review.required && !review.done;
}

/** implement 解禁後の reviewable 編集を記録 */
export function markReviewDirty(root, id, filePath) {
  const prev = loadState(root, id);
  const abs = resolve(filePath);
  const rel = relative(root, abs).split(sep).join('/');
  const review = normalizeReview(prev.review);
  review.required = true;
  review.done = false;
  if (rel && !review.files.includes(rel)) review.files.push(rel);
  return saveState(root, id, { phase: prev.phase, implement: prev.implement, review });
}

/** preToolUse Task で /pre-commit-reviewer が呼ばれたとき */
export function markReviewDone(root, id) {
  const prev = loadState(root, id);
  const review = normalizeReview(prev.review);
  review.done = true;
  return saveState(root, id, { phase: prev.phase, implement: prev.implement, review });
}

/** git commit 成功後に review を初期状態へ */
export function resetReview(root, id) {
  const prev = loadState(root, id);
  return saveState(root, id, { phase: prev.phase, implement: prev.implement, review: defaultReview() });
}

/** implement 解禁後の checkable 編集を溜める（stop で一括 format/lint/typecheck） */
export function markCheckPending(root, id, filePath) {
  const prev = loadState(root, id);
  const abs = resolve(filePath);
  const rel = relative(root, abs).split(sep).join('/');
  const check = normalizeCheck(prev.check);
  if (rel && !check.pending.includes(rel)) check.pending.push(rel);
  return saveState(root, id, { phase: prev.phase, implement: prev.implement, review: prev.review, check });
}

/** stop 実行後 or 許可された git commit 後に pending を空にする */
export function resetCheck(root, id) {
  const prev = loadState(root, id);
  return saveState(root, id, { phase: prev.phase, implement: prev.implement, review: prev.review, check: defaultCheck() });
}

/**
 * sessionStart: ファイルは作らない（起動→resume で捨てられるゴミを防ぐ）。
 * TTL 掃除だけ行う。作成は beforeSubmitPrompt（初回発話）で discussion として行う。
 */
export function onSessionStart(root) {
  return purgeStaleStates(root);
}

/** updatedAt（無ければ mtime）が TTL を超えた *.json を削除 */
export function purgeStaleStates(root, now = Date.now()) {
  const dir = stateDir(root);
  if (!existsSync(dir)) return 0;
  let removed = 0;
  for (const name of readdirSync(dir)) {
    if (!name.endsWith('.json')) continue;
    const full = join(dir, name);
    try {
      let stamp = 0;
      try {
        const raw = JSON.parse(readFileSync(full, 'utf8'));
        if (typeof raw.updatedAt === 'string') {
          const t = Date.parse(raw.updatedAt);
          if (!Number.isNaN(t)) stamp = t;
        }
      } catch {
        // JSON 壊れ → mtime で判定
      }
      if (!stamp) stamp = statSync(full).mtimeMs;
      if (now - stamp > STATE_TTL_MS) {
        unlinkSync(full);
        removed += 1;
      }
    } catch {
      // 個別失敗はスキップ
    }
  }
  return removed;
}

export function isUnlocked(state) {
  const phase = normalizePhase(state?.phase);
  return WORK_PHASES.has(phase) && state?.implement === true;
}

/** パスがゲート state 配下か（エージェント編集禁止用） */
export function isUnderStateDir(root, filePath) {
  if (!filePath) return false;
  const abs = resolve(filePath);
  const dir = resolve(stateDir(root));
  return abs === dir || abs.startsWith(dir + '/');
}

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
import { normalizeReadRefs } from './_refs.mjs';

const hooksDir = fileURLToPath(new URL('.', import.meta.url));
const projectRootFallback = resolve(hooksDir, '../..');

/** 既定フェーズ（議論・調査のみ。コード不可） */
export const PHASE_DISCUSSION = 'discussion';

export const WORK_PHASES = new Set(['spec', 'design', 'forge', 'refine', 'chore']);

/** chore 以外の Spec-flow 作業フェーズ（入場時 issue ハンドシェイク対象） */
export const SPEC_FLOW_PHASES = new Set(['spec', 'design', 'forge', 'refine']);

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

/**
 * transcript パスから conversation UUID を抽出
 */
export function idFromTranscriptPath(transcriptPath) {
  if (!transcriptPath || typeof transcriptPath !== 'string') return null;
  const stem = basename(transcriptPath, '.jsonl');
  if (UUID_RE.test(stem)) return stem;
  const parent = basename(dirname(transcriptPath));
  if (UUID_RE.test(parent)) return parent;
  return null;
}

/** state 配下: 直近 beforeSubmitPrompt で確定した conversation id（ツール hooks 用） */
export const LAST_PROMPT_ID_FILENAME = 'last-prompt-id';

export function lastPromptIdPath(root) {
  return join(stateDir(root), LAST_PROMPT_ID_FILENAME);
}

/** @returns {string | null} */
export function readLastPromptId(root) {
  try {
    const raw = readFileSync(lastPromptIdPath(root), 'utf8').trim();
    if (!raw) return null;
    if (raw.startsWith('{')) {
      const parsed = JSON.parse(raw);
      const id = typeof parsed?.id === 'string' ? parsed.id.trim() : '';
      return id && !isUnknownConversationId(id) ? id : null;
    }
    return !isUnknownConversationId(raw) ? raw : null;
  } catch {
    return null;
  }
}

/** beforeSubmitPrompt で解決した id を sticky として残す（unknown は書かない） */
export function writeLastPromptId(root, id) {
  if (isUnknownConversationId(id)) return null;
  const dir = stateDir(root);
  mkdirSync(dir, { recursive: true });
  const next = {
    id: String(id),
    updatedAt: formatJstIso(),
  };
  writeFileSync(lastPromptIdPath(root), `${JSON.stringify(next, null, 2)}\n`, 'utf8');
  return next;
}

/**
 * ペイロード／env だけから ID を解く（sticky なし）。
 * beforeSubmitPrompt の sticky 更新元、および sticky 未設定時のフォールバック。
 */
export function resolveConversationIdFromPayload(payload) {
  const fromPayload = idFromTranscriptPath(payload?.transcript_path);
  if (fromPayload) return { id: fromPayload, via: 'payload.transcript_path' };
  const fromTranscriptEnv = idFromTranscriptPath(process.env.CURSOR_TRANSCRIPT_PATH);
  if (fromTranscriptEnv) return { id: fromTranscriptEnv, via: 'env.CURSOR_TRANSCRIPT_PATH' };
  if (payload?.conversation_id) {
    return { id: String(payload.conversation_id), via: 'payload.conversation_id' };
  }
  if (payload?.session_id) return { id: String(payload.session_id), via: 'payload.session_id' };
  return { id: 'unknown', via: 'unknown' };
}

/*
 * --- 旧: 全イベントで payload をそのまま state キーにする ---
 * 無効化理由 (2026-07-19): Cursor が tool / beforeReadFile / Shell の hooks に
 * 別セッションの transcript_path・conversation_id を渡す汚染が観測された。
 * 発話 (beforeSubmitPrompt) や Shell の CURSOR_CONVERSATION_ID は正しいのに、
 * ツール系だけ旧 ID になり implement unlock が死ぬ。
 * 参照用に残す（挙動は resolveConversationIdFromPayload と同じ）:
 *
 * export function resolveConversationId_legacyPayloadOnly(payload) {
 *   return resolveConversationIdFromPayload(payload);
 * }
 */

/**
 * state キー解決（新）:
 * - beforeSubmitPrompt → 常に payload（呼び出し側が sticky を更新）
 * - それ以外 → sticky `last-prompt-id` 優先、無ければ payload フォールバック
 *
 * @returns {{ id: string, via: string }}
 */
export function resolveConversationId(payload) {
  const event = String(payload?.hook_event_name ?? '');
  const fromPayload = resolveConversationIdFromPayload(payload);

  if (event === 'beforeSubmitPrompt') {
    return fromPayload;
  }

  const sticky = readLastPromptId(workspaceRoot(payload));
  if (sticky) {
    return { id: sticky, via: 'sticky.last-prompt-id' };
  }
  return fromPayload;
}

/** state キー。resolveConversationId の id のみ。 */
export function conversationId(payload) {
  return resolveConversationId(payload).id;
}

export function isUnknownConversationId(id) {
  return !id || id === 'unknown';
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

/** review は files のみ。空 = commit OK、非空 = 未レビューで commit ブロック */

/** @returns {{ files: string[] }} */
export function defaultReview() {
  return { files: [] };
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

/** 旧 { status } / { required, done } は無視。files だけ残す */
export function normalizeReview(review) {
  if (!review || typeof review !== 'object') return defaultReview();
  const files = Array.isArray(review.files)
    ? [...new Set(review.files.map((f) => String(f)).filter(Boolean))]
    : [];
  return { files };
}

/** @returns {{ phase: string, implement: boolean | null, issue: boolean | null, issueTemplate: boolean, review: ReturnType<typeof defaultReview>, check: ReturnType<typeof defaultCheck>, readRefs: string[], label: string, updatedAt: string }} */
export function defaultState() {
  return {
    phase: PHASE_DISCUSSION,
    implement: null,
    issue: null,
    issueTemplate: false,
    review: defaultReview(),
    check: defaultCheck(),
    readRefs: [],
    label: '',
    updatedAt: formatJstIso(),
  };
}

/** 空文字可。英数字・._- のみ、最大 64（load 時の正規化用） */
function normalizeLabel(label) {
  if (label === undefined || label === null) return '';
  const s = String(label).trim();
  if (!s) return '';
  if (s.length > 64) return '';
  if (!/^[a-zA-Z0-9._-]+$/.test(s)) return '';
  return s;
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

/** discussion / chore → null。Spec-flow → true/false のみ */
export function normalizeIssue(phase, issue) {
  const p = normalizePhase(phase);
  if (!SPEC_FLOW_PHASES.has(p)) return null;
  return issue === true;
}

/** discussion / chore → false（N/A）。Spec-flow → true/false のみ */
export function normalizeIssueTemplate(phase, issueTemplate) {
  const p = normalizePhase(phase);
  if (!SPEC_FLOW_PHASES.has(p)) return false;
  return issueTemplate === true;
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
      issue: normalizeIssue(phase, raw.issue),
      issueTemplate: normalizeIssueTemplate(phase, raw.issueTemplate),
      review: normalizeReview(raw.review),
      check: normalizeCheck(raw.check),
      readRefs: normalizeReadRefs(raw.readRefs),
      label: normalizeLabel(raw.label),
      updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : defaultState().updatedAt,
    };
  } catch {
    return defaultState();
  }
}

export function saveState(root, id, state) {
  if (isUnknownConversationId(id)) return loadState(root, id);
  const dir = stateDir(root);
  mkdirSync(dir, { recursive: true });
  const path = statePath(root, id);
  const prev = loadState(root, id);
  const phase = normalizePhase(state.phase ?? prev.phase);
  const next = {
    phase,
    implement: normalizeImplement(phase, state.implement ?? prev.implement),
    issue: normalizeIssue(phase, state.issue !== undefined ? state.issue : prev.issue),
    issueTemplate: normalizeIssueTemplate(
      phase,
      state.issueTemplate !== undefined ? state.issueTemplate : prev.issueTemplate,
    ),
    review: normalizeReview(state.review ?? prev.review),
    check: normalizeCheck(state.check ?? prev.check),
    readRefs: normalizeReadRefs(state.readRefs !== undefined ? state.readRefs : prev.readRefs),
    label: normalizeLabel(state.label !== undefined ? state.label : prev.label),
    updatedAt: formatJstIso(),
  };
  writeFileSync(path, JSON.stringify(next, null, 2) + '\n', 'utf8');
  return next;
}

/** commit ブロック条件: 未レビュー path が残っているか */
export function isReviewBlocking(state) {
  return normalizeReview(state?.review).files.length > 0;
}

/** implement 解禁後の reviewable 編集を files に積む */
export function markReviewDirty(root, id, filePath) {
  const prev = loadState(root, id);
  const abs = resolve(filePath);
  const rel = relative(root, abs).split(sep).join('/');
  const review = normalizeReview(prev.review);
  if (rel && !review.files.includes(rel)) review.files.push(rel);
  return saveState(root, id, { phase: prev.phase, implement: prev.implement, review });
}

/**
 * preToolUse Task で /pre-commit-reviewer が呼ばれたとき。
 * PASS/GAPS は見ない。起動検知のみ → files クリア。
 */
export function clearReviewFiles(root, id) {
  const prev = loadState(root, id);
  return saveState(root, id, {
    phase: prev.phase,
    implement: prev.implement,
    review: defaultReview(),
  });
}

/** git commit 成功後に review.files を空へ */
export function resetReview(root, id) {
  const prev = loadState(root, id);
  return saveState(root, id, {
    phase: prev.phase,
    implement: prev.implement,
    review: defaultReview(),
    readRefs: prev.readRefs,
  });
}

/** implement/references の Read を記録 */
export function markReadRef(root, id, refBasename) {
  const prev = loadState(root, id);
  const readRefs = normalizeReadRefs([...(prev.readRefs ?? []), refBasename]);
  return saveState(root, id, {
    phase: prev.phase,
    implement: prev.implement,
    review: prev.review,
    check: prev.check,
    readRefs,
  });
}

/** フェーズ入場・再入場で reference 既読をクリア */
export function clearReadRefs(root, id) {
  const prev = loadState(root, id);
  return saveState(root, id, {
    phase: prev.phase,
    implement: prev.implement,
    review: prev.review,
    check: prev.check,
    readRefs: [],
  });
}

/** implement 解禁後の checkable 編集を溜める（stop で一括 format/lint/typecheck） */
export function markCheckPending(root, id, filePath) {
  const prev = loadState(root, id);
  const abs = resolve(filePath);
  const rel = relative(root, abs).split(sep).join('/');
  const check = normalizeCheck(prev.check);
  if (rel && !check.pending.includes(rel)) check.pending.push(rel);
  return saveState(root, id, {
    phase: prev.phase,
    implement: prev.implement,
    review: prev.review,
    check,
  });
}

/** stop 実行後 or 許可された git commit 後に pending を空にする */
export function resetCheck(root, id) {
  const prev = loadState(root, id);
  return saveState(root, id, {
    phase: prev.phase,
    implement: prev.implement,
    review: prev.review,
    check: defaultCheck(),
  });
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

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
import { join, resolve } from 'node:path';
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

export function conversationId(payload) {
  return String(payload?.conversation_id || payload?.session_id || 'unknown');
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

/** @returns {{ phase: string, implement: boolean, updatedAt: string }} */
export function defaultState() {
  return {
    phase: PHASE_DISCUSSION,
    implement: false,
    updatedAt: formatJstIso(),
  };
}

function normalizePhase(phase) {
  if (phase === PHASE_DISCUSSION || WORK_PHASES.has(phase)) return phase;
  return PHASE_DISCUSSION;
}

export function loadState(root, id) {
  const name = findStateFileName(root, id);
  if (!name) return defaultState();
  try {
    const raw = JSON.parse(readFileSync(join(stateDir(root), name), 'utf8'));
    return {
      phase: normalizePhase(typeof raw.phase === 'string' ? raw.phase : PHASE_DISCUSSION),
      implement: Boolean(raw.implement),
      updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : defaultState().updatedAt,
    };
  } catch {
    return defaultState();
  }
}

export function saveState(root, id, state) {
  const dir = stateDir(root);
  mkdirSync(dir, { recursive: true });
  // 既存があれば同じファイルを更新。無ければ作成時スタンプで新規。
  const path = statePath(root, id);
  const next = {
    phase: normalizePhase(state.phase ?? PHASE_DISCUSSION),
    implement: Boolean(state.implement),
    updatedAt: formatJstIso(),
  };
  writeFileSync(path, JSON.stringify(next, null, 2) + '\n', 'utf8');
  return next;
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
  return WORK_PHASES.has(phase) && Boolean(state?.implement);
}

/** パスがゲート state 配下か（エージェント編集禁止用） */
export function isUnderStateDir(root, filePath) {
  if (!filePath) return false;
  const abs = resolve(filePath);
  const dir = resolve(stateDir(root));
  return abs === dir || abs.startsWith(dir + '/');
}

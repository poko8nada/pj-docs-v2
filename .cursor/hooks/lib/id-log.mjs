/**
 * conversation id 汚染の観測用。fail-open（失敗しても hooks を止めない）。
 * 出力: `.cursor/hooks/probe/`（gitignore 済み）
 *
 * 方針:
 * - 無限追記しない（行数上限、古い行から落とす）
 * - mismatch / healthy 遷移 / beforeSubmitPrompt は必ず残す
 * - sticky と payload が一致し続ける通常ツールイベントは間引き
 * - 連続一致で `cursor_id_healthy: true`（Cursor 側改修の探知用）
 *
 * 無効: CURSOR_GATE_ID_LOG=0 / スモーク（CURSOR_GATE_STATE_DIR）
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import {
  formatJstIso,
  isUnknownConversationId,
  readLastPromptId,
  resolveConversationId,
  resolveConversationIdFromPayload,
  workspaceRoot,
} from './state.mjs';

/** id.jsonl の最大行数（超過分は先頭＝古い方を破棄） */
const MAX_LOG_LINES = 200;

/** payload と sticky がこの回数連続一致したら healthy */
const HEALTHY_STREAK = 5;

/** 一致中の通常ツール行を何件に1回残すか（1=毎回、0=残さない） */
const MATCH_SAMPLE_EVERY = 20;

function enabled() {
  if (process.env.CURSOR_GATE_ID_LOG === '0') return false;
  if (process.env.CURSOR_GATE_STATE_DIR) return false;
  return true;
}

function probeDir(root) {
  return join(root, '.cursor/hooks/probe');
}

function logPath(root) {
  return join(probeDir(root), 'id.jsonl');
}

function healthPath(root) {
  return join(probeDir(root), 'id-health.json');
}

function readHealth(root) {
  try {
    const raw = JSON.parse(readFileSync(healthPath(root), 'utf8'));
    return {
      matchStreak: Number(raw.matchStreak) || 0,
      healthy: raw.healthy === true,
      sampleCounter: Number(raw.sampleCounter) || 0,
    };
  } catch {
    return { matchStreak: 0, healthy: false, sampleCounter: 0 };
  }
}

function writeHealth(root, health) {
  mkdirSync(dirname(healthPath(root)), { recursive: true });
  writeFileSync(
    healthPath(root),
    `${JSON.stringify({ ...health, updatedAt: formatJstIso() }, null, 2)}\n`,
    'utf8',
  );
}

function appendCapped(root, lineObj) {
  const path = logPath(root);
  mkdirSync(dirname(path), { recursive: true });
  const line = `${JSON.stringify(lineObj)}\n`;
  let body = '';
  if (existsSync(path)) {
    try {
      body = readFileSync(path, 'utf8');
    } catch {
      body = '';
    }
  }
  const lines = body ? body.split('\n').filter((l) => l.length > 0) : [];
  lines.push(line.trimEnd());
  const kept = lines.length > MAX_LOG_LINES ? lines.slice(lines.length - MAX_LOG_LINES) : lines;
  writeFileSync(path, `${kept.join('\n')}\n`, 'utf8');
}

/**
 * @param {unknown} payload
 * @param {string} source track.mjs | gate-core | inject-context | check.mjs
 */
export function logHookIds(payload, source) {
  if (!enabled()) return;
  try {
    const root = workspaceRoot(payload);
    const event = String(payload?.hook_event_name ?? '');
    const resolved = resolveConversationId(payload);
    const fromPayload = resolveConversationIdFromPayload(payload);
    const sticky = readLastPromptId(root);
    const payloadId = fromPayload.id;
    const bothKnown =
      sticky && !isUnknownConversationId(sticky) && !isUnknownConversationId(payloadId);
    const mismatch = bothKnown ? sticky !== payloadId : false;

    const health = readHealth(root);
    let healthTransition = null;

    // ツール系で sticky と payload を比較して healthy 探知
    const isToolish =
      event === 'preToolUse' ||
      event === 'postToolUse' ||
      event === 'beforeReadFile' ||
      event === 'beforeShellExecution' ||
      event === 'afterShellExecution';

    if (isToolish && bothKnown) {
      if (mismatch) {
        if (health.healthy) healthTransition = false;
        health.matchStreak = 0;
        health.healthy = false;
      } else {
        health.matchStreak += 1;
        if (!health.healthy && health.matchStreak >= HEALTHY_STREAK) {
          health.healthy = true;
          healthTransition = true;
        }
      }
      writeHealth(root, health);
    }

    const isPrompt = event === 'beforeSubmitPrompt';
    let shouldLog = isPrompt || mismatch || healthTransition !== null;

    if (!shouldLog && isToolish && bothKnown && !mismatch) {
      health.sampleCounter = (health.sampleCounter + 1) % Math.max(MATCH_SAMPLE_EVERY, 1);
      writeHealth(root, health);
      if (MATCH_SAMPLE_EVERY > 0 && health.sampleCounter === 0) shouldLog = true;
    }

    // sticky 未設定・unknown などは初回診断用に残す（間引きしすぎない）
    if (!shouldLog && !bothKnown && (isToolish || event === 'sessionStart')) {
      shouldLog = true;
    }

    if (!shouldLog) return;

    appendCapped(root, {
      ts: formatJstIso(),
      source: String(source ?? ''),
      hook_event_name: payload?.hook_event_name ?? null,
      tool_name: payload?.tool_name ?? null,
      resolved_id: resolved.id,
      resolved_via: resolved.via,
      sticky_id: sticky,
      payload_id: payloadId,
      payload_via: fromPayload.via,
      mismatch,
      cursor_id_healthy: health.healthy,
      healthy_transition: healthTransition,
      match_streak: health.matchStreak,
      payload_conversation_id: payload?.conversation_id ?? null,
      payload_session_id: payload?.session_id ?? null,
      payload_transcript_path: payload?.transcript_path ?? null,
      env_CURSOR_CONVERSATION_ID: process.env.CURSOR_CONVERSATION_ID ?? null,
      env_CURSOR_TRANSCRIPT_PATH: process.env.CURSOR_TRANSCRIPT_PATH ?? null,
    });
  } catch {
    // fail-open
  }
}

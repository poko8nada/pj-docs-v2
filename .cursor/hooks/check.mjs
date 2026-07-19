#!/usr/bin/env node
/**
 * check.mjs — 編集ファイルを溜め、エージェント停止時に format/lint/typecheck を一括実行。
 *
 * | Event | Action |
 * |-------|--------|
 * | stop | pending があれば format/lint/typecheck → 失敗時 followup（loop_count 制限） |
 * | beforeSubmitPrompt | leftover pending をフラッシュ（stop 漏れの保険） |
 */
import { buildCheckFollowup, runFormatLint } from './_check.mjs';
import { logHookIds } from './_id-log.mjs';
import {
  conversationId,
  isUnlocked,
  loadState,
  normalizeCheck,
  resetCheck,
  workspaceRoot,
} from './_state.mjs';

async function readStdinJson() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  const text = Buffer.concat(chunks).toString('utf8').trim();
  if (!text) return {};
  return JSON.parse(text);
}

function respond(payload) {
  process.stdout.write(JSON.stringify(payload) + '\n');
}

function empty() {
  respond({});
}

const FOLLOWUP_LOOP_LIMIT = 1;

function runPendingChecks(root, id) {
  const state = loadState(root, id);
  if (!isUnlocked(state)) return { ran: false, result: { ok: true } };

  const pending = normalizeCheck(state.check).pending;
  if (pending.length === 0) return { ran: false, result: { ok: true } };

  const result = runFormatLint(root, pending);
  resetCheck(root, id);
  return { ran: true, result };
}

function maybeFollowup(result, loopCount) {
  if (result.ok) return empty();
  if (loopCount >= FOLLOWUP_LOOP_LIMIT) return empty();
  const followup = buildCheckFollowup(result.message);
  if (followup) return respond({ followup_message: followup });
  return empty();
}

function handleStop(root, payload) {
  const id = conversationId(payload);
  const loopCount = Number(payload.loop_count ?? 0);
  const { result, ran } = runPendingChecks(root, id);
  if (!ran) return empty();
  return maybeFollowup(result, loopCount);
}

function handleBeforeSubmitPrompt(root, payload) {
  const id = conversationId(payload);
  const { result, ran } = runPendingChecks(root, id);
  if (!ran || result.ok) return empty();
  const body = String(result.message ?? '').trim();
  return respond({
    continue: false,
    user_message: `[harness-check] Fix format/lint/typecheck issues before sending:\n\n${body}`,
  });
}

async function main() {
  const payload = await readStdinJson();
  logHookIds(payload, 'check.mjs');
  const root = workspaceRoot(payload);
  const event = payload.hook_event_name ?? '';

  if (event === 'stop') {
    return handleStop(root, payload);
  }

  if (event === 'beforeSubmitPrompt') {
    return handleBeforeSubmitPrompt(root, payload);
  }

  return empty();
}

main().catch(() => empty());

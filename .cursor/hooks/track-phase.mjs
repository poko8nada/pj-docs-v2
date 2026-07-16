#!/usr/bin/env node
/**
 * beforeSubmitPrompt
 * - この会話で初めての発話 → 無ければ discussion state を作成（implement: null）
 * - /discussion → discussion に戻す（implement: null）
 * - /spec|/design|/forge|/refine|/chore → 作業フェーズ（implement: false または維持）
 * - /bootstrap → 非常口マーカー作成、/bootstrap off → 削除（state は触らない）
 */
import { disableBootstrap, enableBootstrap } from './_bootstrap.mjs';
import {
  conversationId,
  findStateFileName,
  loadState,
  normalizeImplement,
  PHASE_DISCUSSION,
  saveState,
  workspaceRoot,
} from './_state.mjs';

const PHASE_RE = /(?:^|[\s`])\/(discussion|spec|design|forge|refine|chore)(?=[\s`/]|$)/i;
const BOOTSTRAP_OFF_RE = /(?:^|[\s`])\/bootstrap\s+off(?=[\s`/]|$)/i;
const BOOTSTRAP_ON_RE = /(?:^|[\s`])\/bootstrap(?=[\s`/]|$)/i;

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

async function main() {
  const payload = await readStdinJson();
  const root = workspaceRoot(payload);
  const id = conversationId(payload);
  const prompt = String(payload.prompt ?? '');

  if (BOOTSTRAP_OFF_RE.test(prompt)) {
    disableBootstrap(root);
  } else if (BOOTSTRAP_ON_RE.test(prompt)) {
    enableBootstrap(root);
  }

  // 初回発話で discussion を実体化（起動だけ／未発話の resume 捨て打ちでは作らない）
  if (!findStateFileName(root, id)) {
    saveState(root, id, { phase: PHASE_DISCUSSION, implement: null });
  }

  const match = prompt.match(PHASE_RE);
  if (match) {
    const phase = match[1].toLowerCase();
    const prev = loadState(root, id);
    let implement;
    if (phase === PHASE_DISCUSSION) {
      implement = null;
    } else if (prev.phase === phase) {
      implement = normalizeImplement(phase, prev.implement);
    } else {
      implement = false;
    }
    saveState(root, id, { phase, implement });
  }

  return respond({ continue: true });
}

main().catch(() => {
  // fail-open: プロンプト自体は止めない
  respond({ continue: true });
});

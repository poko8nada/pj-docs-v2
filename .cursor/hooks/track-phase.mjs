#!/usr/bin/env node
/**
 * beforeSubmitPrompt
 * - この会話で初めての発話 → 無ければ discussion state を作成
 * - /spec|/design|/forge|/refine|/chore があれば phase を更新
 */
import {
  conversationId,
  findStateFileName,
  loadState,
  PHASE_DISCUSSION,
  saveState,
  workspaceRoot,
} from './state.mjs';

const PHASE_RE = /(?:^|[\s`])\/(spec|design|forge|refine|chore)(?=[\s`/]|$)/i;

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

  // 初回発話で discussion を実体化（起動だけ／未発話の resume 捨て打ちでは作らない）
  if (!findStateFileName(root, id)) {
    saveState(root, id, { phase: PHASE_DISCUSSION, implement: false });
  }

  const match = prompt.match(PHASE_RE);
  if (match) {
    const phase = match[1].toLowerCase();
    const prev = loadState(root, id);
    // フェーズ切替時のみ implement をリセット（同フェーズ再入場は維持）
    const implement = prev.phase === phase ? prev.implement : false;
    saveState(root, id, { phase, implement });
  }

  return respond({ continue: true });
}

main().catch(() => {
  // fail-open: プロンプト自体は止めない
  respond({ continue: true });
});

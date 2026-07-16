#!/usr/bin/env node
/**
 * beforeReadFile — 作業フェーズ中に implement/SKILL.md を読んだら implement: true。
 * discussion 中は何もしない（フラグもファイルも触らない）。
 */
import { isAbsolute, join, normalize, resolve } from 'node:path';
import { conversationId, loadState, saveState, WORK_PHASES, workspaceRoot } from './state.mjs';

async function readStdinJson() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  const text = Buffer.concat(chunks).toString('utf8').trim();
  if (!text) return {};
  return JSON.parse(text);
}

function allow() {
  process.stdout.write(JSON.stringify({ permission: 'allow' }) + '\n');
}

function isImplementSkill(root, filePath) {
  if (!filePath) return false;
  const abs = normalize(isAbsolute(filePath) ? filePath : resolve(root, filePath));
  const target = normalize(join(root, '.cursor/skills/implement/SKILL.md'));
  return abs === target;
}

async function main() {
  const payload = await readStdinJson();
  const root = workspaceRoot(payload);
  const filePath = payload.file_path ?? payload.filePath ?? '';

  if (isImplementSkill(root, String(filePath))) {
    const id = conversationId(payload);
    const prev = loadState(root, id);
    if (WORK_PHASES.has(prev.phase)) {
      saveState(root, id, { phase: prev.phase, implement: true });
    }
  }

  return allow();
}

main().catch(() => {
  allow();
});

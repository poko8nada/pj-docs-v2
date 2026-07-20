#!/usr/bin/env node
/**
 * gate.mjs — 薄い入口（bootstrap 救命胴衣）。
 *
 * hooks.json はここを指す。本体は `_gate-core.mjs`。
 * 本体の import / 実行が壊れても、bootstrap 中なら allow して修復可能にする。
 * （entry 自体と `_bootstrap.mjs` は壊さないこと。）
 */
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { isBootstrapActive } from './_bootstrap.mjs';
import { playDenySound } from './_notify-deny.mjs';

/** entry は _state に依存しない（state 壊れでも bootstrap 救済できるように） */
const PROJECT_ROOT_FALLBACK = resolve(fileURLToPath(new URL('../..', import.meta.url)));

function workspaceRoot(payload) {
  const roots = payload?.workspace_roots;
  if (Array.isArray(roots) && roots[0]) return resolve(roots[0]);
  if (payload?.cwd) return resolve(payload.cwd);
  return PROJECT_ROOT_FALLBACK;
}

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

function deny(message) {
  playDenySound();
  process.stdout.write(
    JSON.stringify({
      permission: 'deny',
      agent_message: message,
      user_message: message,
    }) + '\n',
  );
}

function coreModuleUrl() {
  // テスト用: 壊れた core を差し替える
  if (process.env.CURSOR_GATE_CORE_PATH) {
    return pathToFileURL(resolve(process.env.CURSOR_GATE_CORE_PATH)).href;
  }
  return new URL('./_gate-core.mjs', import.meta.url).href;
}

async function main() {
  const payload = await readStdinJson();
  const root = workspaceRoot(payload);
  try {
    const { handleGate } = await import(coreModuleUrl());
    await handleGate(payload);
  } catch (error) {
    if (isBootstrapActive(root)) return allow();
    deny(`[gate] ${error instanceof Error ? error.message : String(error)}`);
  }
}

main().catch((error) => {
  // stdin 破損など entry 側の失敗。bootstrap は root 不明のことがあるので env も見る。
  try {
    const root = workspaceRoot({});
    if (isBootstrapActive(root)) return allow();
  } catch {
    // ignore
  }
  if (process.env.CURSOR_GATE_BOOTSTRAP === '1') return allow();
  deny(`[gate] ${error instanceof Error ? error.message : String(error)}`);
});

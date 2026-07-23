#!/usr/bin/env node
/**
 * sessionEnd — bootstrap マーカーを消す（付けっぱなし防止）。fire-and-forget。
 */
import { disableBootstrap } from './lib/bootstrap.mjs';
import { workspaceRoot } from './lib/state.mjs';

async function readStdinJson() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  const text = Buffer.concat(chunks).toString('utf8').trim();
  if (!text) return {};
  return JSON.parse(text);
}

async function main() {
  const payload = await readStdinJson();
  const root = workspaceRoot(payload);
  disableBootstrap(root);
  process.stdout.write('{}\n');
}

main().catch(() => {
  process.stdout.write('{}\n');
});

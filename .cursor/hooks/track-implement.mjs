#!/usr/bin/env node
/**
 * implement/SKILL.md の Read を検知して implement: true。
 * beforeReadFile + preToolUse(Read) + postToolUse(Read)。
 * discussion 中は何もしない（implement は null のまま）。
 */
import { realpathSync } from 'node:fs';
import { isAbsolute, join, resolve } from 'node:path';
import { conversationId, loadState, saveState, WORK_PHASES, workspaceRoot } from './_state.mjs';

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

function empty() {
  process.stdout.write('{}\n');
}

function filePathFromPayload(payload) {
  const toolInput = payload.tool_input ?? {};
  return (
    payload.file_path ??
    payload.filePath ??
    toolInput.path ??
    toolInput.filePath ??
    toolInput.file_path ??
    toolInput.file ??
    ''
  );
}

function isImplementSkill(root, filePath) {
  if (!filePath) return false;
  try {
    const abs = realpathSync(isAbsolute(filePath) ? filePath : resolve(root, filePath));
    const target = realpathSync(join(root, '.cursor/skills/implement/SKILL.md'));
    return abs === target;
  } catch {
    return false;
  }
}

function maybeUnlock(root, payload) {
  const filePath = filePathFromPayload(payload);
  if (!isImplementSkill(root, String(filePath))) return;
  const id = conversationId(payload);
  const prev = loadState(root, id);
  if (WORK_PHASES.has(prev.phase)) {
    saveState(root, id, { phase: prev.phase, implement: true });
  }
}

async function main() {
  const payload = await readStdinJson();
  const root = workspaceRoot(payload);
  const event = payload.hook_event_name ?? '';
  const toolName = payload.tool_name ?? '';

  const isReadTool = toolName === 'Read' || toolName === 'ReadFile';
  const isReadEvent =
    event === 'beforeReadFile' ||
    ((event === 'preToolUse' || event === 'postToolUse') && isReadTool);

  if (isReadEvent) {
    maybeUnlock(root, payload);
  }

  if (event === 'postToolUse') return empty();
  return allow();
}

main().catch(() => {
  allow();
});

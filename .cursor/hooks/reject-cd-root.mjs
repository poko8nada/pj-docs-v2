#!/usr/bin/env node
/**
 * Shell の cwd がすでに workspace root のとき、root への `cd` を拒否する。
 * restrict-root（外部パス禁止）とは別枠。無意味な `cd` を減らすためのガード。
 */
import { homedir } from 'node:os';
import { isAbsolute, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const hooksDir = fileURLToPath(new URL('.', import.meta.url));
const projectRootFallback = resolve(hooksDir, '../..');

const DENY =
  '[reject-cd-root] Shell is already at the workspace root. Remove `cd` and any absolute path to the workspace (including `git -C`). Run commands as-is — e.g. `git add … && git commit …`.';

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
  process.stdout.write(
    JSON.stringify({
      permission: 'deny',
      agent_message: message,
      user_message: message,
    }) + '\n',
  );
}

function workspaceRoot(payload) {
  const roots = payload.workspace_roots;
  if (Array.isArray(roots) && roots[0]) return resolve(roots[0]);
  if (payload.cwd) return resolve(payload.cwd);
  return projectRootFallback;
}

function shellCwd(payload, root) {
  if (payload.cwd) return resolve(payload.cwd);
  return root;
}

function expandPath(filePath) {
  if (filePath === '~') return homedir();
  if (filePath.startsWith('~/')) return join(homedir(), filePath.slice(2));
  return filePath;
}

function resolveCdTarget(cwd, arg) {
  const expanded = expandPath(arg);
  return isAbsolute(expanded) ? normalize(expanded) : normalize(resolve(cwd, expanded));
}

function stripNoise(command) {
  let cleaned = command.replace(/<<-?\s*["']?(\w+)["']?[\s\S]*?\n\s*\1/g, '');
  cleaned = cleaned.replace(/(["'])(?:\\.|(?!\1)[^\\])*\1/g, '""');
  return cleaned;
}

/** 左から順に `cd` を辿り、シミュレートした cwd を更新する */
function extractCdArgs(command) {
  const cleaned = stripNoise(command);
  const args = [];
  const re = /\bcd(?:\s+(?:"([^"]*)"|'([^']*)'|([^\s;&|)]+)))?/g;
  let m;
  while ((m = re.exec(cleaned))) {
    args.push(m[1] ?? m[2] ?? m[3] ?? '');
  }
  return args;
}

function cdsToProjectRoot(command, cwd, root) {
  const resolvedRoot = resolve(root);
  let simulated = cwd;

  for (const arg of extractCdArgs(command)) {
    if (!arg || arg === '-') continue;
    const target = resolveCdTarget(simulated, arg);
    if (target === resolvedRoot) return true;
    simulated = target;
  }

  return false;
}

async function main() {
  const payload = await readStdinJson();
  const event = payload.hook_event_name ?? '';

  if (event !== 'beforeShellExecution' && !payload.command) {
    return allow();
  }

  const command = String(payload.command ?? payload.tool_input?.command ?? '');
  if (!command.trim()) return allow();

  const root = workspaceRoot(payload);
  const cwd = shellCwd(payload, root);

  if (cdsToProjectRoot(command, cwd, root)) return deny(DENY);
  return allow();
}

main().catch((error) => {
  const message = `[reject-cd-root] ${error instanceof Error ? error.message : String(error)}`;
  deny(message);
});

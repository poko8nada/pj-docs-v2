#!/usr/bin/env node
import { homedir } from 'node:os';
import { isAbsolute, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const hooksDir = fileURLToPath(new URL('.', import.meta.url));
const projectRootFallback = resolve(hooksDir, '../..');

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

function expandPath(filePath) {
  if (filePath === '~') return homedir();
  if (filePath.startsWith('~/')) return join(homedir(), filePath.slice(2));
  return filePath;
}

function normalizePath(root, filePath) {
  const expanded = expandPath(filePath);
  const absolute = isAbsolute(expanded) ? expanded : resolve(root, expanded);
  return normalize(absolute);
}

function allowedExternalRoots() {
  const xdg = process.env.XDG_CONFIG_HOME ?? join(homedir(), '.config');
  return [join(homedir(), '.cursor'), join(xdg, 'opencode')];
}

function isInside(root, target) {
  const r = resolve(root);
  const t = resolve(target);
  return t === r || t.startsWith(r + '/');
}

function extractPathsFromCommand(command) {
  let cleaned = command.replace(/<<-?\s*["']?(\w+)["']?[\s\S]*?\n\s*\1/g, '');
  cleaned = cleaned.replace(/(["'])(?:\\.|(?!\1)[^\\])*\1/g, '');
  const paths = [];
  for (const m of cleaned.matchAll(/(?:^|[\s>|&;"'])([/~][^\s'"<>|&;]+)/g)) {
    const p = m[1];
    if (p && !p.startsWith('//')) paths.push(p);
  }
  return paths;
}

function checkPath(root, filePath) {
  if (!filePath || filePath === '/dev/null') return null;
  if (filePath.startsWith('-')) return null;
  const normalized = normalizePath(root, filePath);
  if (isInside(root, normalized)) return null;
  if (allowedExternalRoots().some((p) => isInside(p, normalized))) return null;
  return `[restrict-root] Access outside the project root directory is prohibited: ${filePath}`;
}

function fileArgFromToolInput(toolInput) {
  if (!toolInput || typeof toolInput !== 'object') return undefined;
  return (
    toolInput.path ??
    toolInput.filePath ??
    toolInput.file_path ??
    toolInput.file ??
    toolInput.target_notebook ??
    undefined
  );
}

async function main() {
  const payload = await readStdinJson();
  const root = workspaceRoot(payload);
  const event = payload.hook_event_name ?? '';

  if (event === 'beforeShellExecution' || payload.command) {
    const command = String(payload.command ?? payload.tool_input?.command ?? '');
    for (const p of extractPathsFromCommand(command)) {
      const err = checkPath(root, p);
      if (err) return deny(err);
    }
    return allow();
  }

  if (event === 'beforeReadFile') {
    const err = checkPath(root, payload.file_path);
    if (err) return deny(err);
    return allow();
  }

  const toolInput = payload.tool_input ?? {};
  const fileArg = fileArgFromToolInput(toolInput) ?? payload.file_path;
  if (fileArg) {
    const err = checkPath(root, String(fileArg));
    if (err) return deny(err);
  }

  if (payload.tool_name === 'Shell' || payload.tool_name === 'Bash') {
    const command = String(toolInput.command ?? '');
    for (const p of extractPathsFromCommand(command)) {
      const err = checkPath(root, p);
      if (err) return deny(err);
    }
  }

  return allow();
}

main().catch((error) => {
  process.stdout.write(
    JSON.stringify({
      permission: 'deny',
      agent_message: `[restrict-root] ${error instanceof Error ? error.message : String(error)}`,
      user_message: `[restrict-root] ${error instanceof Error ? error.message : String(error)}`,
    }) + '\n',
  );
});

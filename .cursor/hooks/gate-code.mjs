#!/usr/bin/env node
/**
 * phase + implement Read まで、プロダクト／ハーネスのコード編集を止める。
 * 対象: preToolUse（Write|StrReplace|Delete|EditNotebook）、beforeShellExecution。
 * ルート直下 *.md は常時許可。未解禁の Shell は gh / git / 読み取り系のみ。
 * `.cursor/hooks/state/**` は解禁後も常時編集禁止（Read は可）。
 */
import { basename, isAbsolute, relative, resolve, sep } from 'node:path';
import {
  conversationId,
  isUnderStateDir,
  isUnlocked,
  loadState,
  stateDir,
  workspaceRoot,
} from './state.mjs';

const DENY_CODE =
  '[gate] Code edits require a work phase (/spec|/design|/forge|/refine|/chore) and Read of .cursor/skills/implement/SKILL.md. Default phase is discussion (no code).';

const DENY_SHELL =
  '[gate] This shell command requires a work phase + implement Read. Without unlock: gh, git, and read-only commands only.';

const DENY_STATE =
  '[gate] Gate state files are hooks-only. Read is allowed; do not edit `.cursor/hooks/state/**`.';

const READONLY_CMDS = new Set([
  'ls',
  'pwd',
  'cat',
  'head',
  'tail',
  'wc',
  'file',
  'which',
  'whereis',
  'type',
  'true',
  'false',
  'test',
  'echo',
  'printf',
  'rg',
  'grep',
  'egrep',
  'fgrep',
  'find',
  'sort',
  'uniq',
  'diff',
  'stat',
  'dirname',
  'basename',
  'realpath',
  'readlink',
  'env',
  'printenv',
  'date',
  'uname',
  'whoami',
  'id',
]);

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

/** プロジェクトルート直下の *.md のみ（ネストは不可） */
function isRootMarkdown(root, filePath) {
  if (!filePath) return false;
  const abs = resolve(isAbsolute(filePath) ? filePath : resolve(root, filePath));
  const rel = relative(root, abs);
  if (!rel || rel.startsWith('..') || rel.includes(`..${sep}`)) return false;
  if (rel.includes(sep) || rel.includes('/')) return false;
  return /\.md$/i.test(rel);
}

function stripQuotesAndHeredoc(command) {
  let cleaned = command.replace(/<<-?\s*["']?(\w+)["']?[\s\S]*?\n\s*\1/g, ' ');
  cleaned = cleaned.replace(/(["'])(?:\\.|(?!\1)[^\\])*\1/g, ' ');
  return cleaned;
}

function firstCommandToken(segment) {
  let s = segment.trim();
  if (!s) return '';
  // 先頭の環境変数代入を落とす: FOO=bar BAZ=1 cmd
  while (/^[A-Za-z_][A-Za-z0-9_]*=/.test(s)) {
    const sp = s.search(/\s/);
    if (sp === -1) return '';
    s = s.slice(sp).trim();
  }
  // sudo / command / time の軽いラッパを飛ばす
  const parts = s.split(/\s+/).filter(Boolean);
  let i = 0;
  while (
    i < parts.length &&
    (parts[i] === 'sudo' || parts[i] === 'command' || parts[i] === 'time')
  ) {
    i += 1;
  }
  let cmd = parts[i] || '';
  if (cmd.includes('/')) cmd = basename(cmd);
  return cmd.toLowerCase();
}

function mentionsStateDir(root, command) {
  const abs = stateDir(root);
  return String(command).includes('.cursor/hooks/state') || String(command).includes(abs);
}

/**
 * state 配下への書き込みっぽい Shell か。
 * `2>/dev/null` のようなリダイレクトは書き込み扱いしない。
 */
function isShellWriteToState(root, command) {
  const cmd = String(command ?? '');
  if (!mentionsStateDir(root, cmd)) return false;
  if (/\b(rm|mv|cp|tee|truncate)\b/.test(cmd)) return true;

  const abs = stateDir(root);
  const re = /(?:^|[\s;|&])(?:\d*)>{1,2}\s*([^\s;|&]+)/g;
  let m;
  while ((m = re.exec(cmd)) !== null) {
    const target = m[1];
    if (target === '/dev/null') continue;
    if (target.includes('.cursor/hooks/state') || target.includes(abs)) return true;
  }
  return false;
}

function isAllowedWithoutUnlock(command) {
  const cleaned = stripQuotesAndHeredoc(String(command ?? ''));
  const segments = cleaned
    .split(/&&|\|\||;|\n|\|/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (segments.length === 0) return true;
  return segments.every((seg) => {
    const cmd = firstCommandToken(seg);
    if (!cmd) return true;
    if (cmd === 'gh' || cmd === 'git') return true;
    if (READONLY_CMDS.has(cmd)) return true;
    return false;
  });
}

async function main() {
  const payload = await readStdinJson();
  const root = workspaceRoot(payload);
  const id = conversationId(payload);
  const state = loadState(root, id);
  const unlocked = isUnlocked(state);
  const event = payload.hook_event_name ?? '';
  const toolName = payload.tool_name ?? '';

  // Shell 判定はイベント／ツール名のみ（payload.command の有無では見ない — Write 誤判定を防ぐ）
  const isShellEvent =
    event === 'beforeShellExecution' || toolName === 'Shell' || toolName === 'Bash';

  if (isShellEvent) {
    const command = String(payload.command ?? payload.tool_input?.command ?? '');
    if (isShellWriteToState(root, command)) {
      return deny(DENY_STATE);
    }
    if (unlocked) return allow();
    if (isAllowedWithoutUnlock(command)) return allow();
    return deny(DENY_SHELL);
  }

  // ファイル変更系: state 配下は常時 deny
  const toolInput = payload.tool_input ?? {};
  const fileArg = fileArgFromToolInput(toolInput) ?? payload.file_path;
  if (fileArg) {
    const abs = resolve(
      isAbsolute(String(fileArg)) ? String(fileArg) : resolve(root, String(fileArg)),
    );
    if (isUnderStateDir(root, abs)) return deny(DENY_STATE);
  }

  if (unlocked) return allow();
  if (fileArg && isRootMarkdown(root, String(fileArg))) return allow();
  return deny(DENY_CODE);
}

main().catch((error) => {
  deny(`[gate] ${error instanceof Error ? error.message : String(error)}`);
});

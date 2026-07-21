/**
 * _gate-core.mjs — gate 本体（許可/拒否のみ。state は書かない）
 * 入口は `gate.mjs`（bootstrap 救命胴衣）。ここを壊しても entry が bootstrap 中は allow できる。
 *
 * | Event              | Checks                                              |
 * |--------------------|-----------------------------------------------------|
 * | beforeShellExecution | state/bootstrap, cd-root, outside-root, review, code |
 * | preToolUse (file)  | state/bootstrap, outside-root, code unlock            |
 * | beforeReadFile     | outside-root                                        |
 */
import { homedir } from 'node:os';
import { basename, isAbsolute, join, normalize, relative, resolve, sep } from 'node:path';
import {
  isBootstrapActive,
  isBootstrapMarkerPath,
  isShellWriteToBootstrapMarker,
} from './_bootstrap.mjs';
import { logHookIds } from './_id-log.mjs';
import { commandIncludesGitCommit, denyReviewMessage } from './_review.mjs';
import { denyRefsMessage, missingRefs, requiredRefsForPath } from './_refs.mjs';
import {
  commandIncludesGhIssueMutation,
  denyIssueMessage,
  isIssueReady,
  isSpecFlowPhase,
} from './_issue.mjs';
import {
  conversationId,
  isReviewBlocking,
  isUnderStateDir,
  isUnlocked,
  loadState,
  normalizeReview,
  stateDir,
  WORK_PHASES,
  workspaceRoot,
} from './_state.mjs';
import { playDenySound } from './_notify-deny.mjs';

const WRITE_TOOLS = new Set(['Write', 'StrReplace', 'Delete', 'EditNotebook']);

const DENY_STATE =
  '[gate] Gate state files are hooks-only. Read is allowed; do not edit `.cursor/hooks/state/**`.';

/** @param {string} phase */
function denyCodeMessage(phase) {
  const p = phase || 'discussion';
  if (WORK_PHASES.has(p)) {
    return `[gate] Edits blocked (phase=${p}, rules≠true). Read .cursor/skills/rules/SKILL.md to unlock.`;
  }
  return `[gate] Edits blocked (phase=${p}). Enter a work phase (/work|/chore|/spec|/design|/forge|/refine), then Read .cursor/skills/rules/SKILL.md.`;
}

/** @param {string} phase */
function denyShellMessage(phase) {
  const p = phase || 'discussion';
  if (WORK_PHASES.has(p)) {
    return `[gate] Shell blocked (phase=${p}, rules≠true). gh/git are allowed; other commands need rules Read. Prefer --body-file path over <(cat <<EOF) if a gh/git command was denied unexpectedly.`;
  }
  return `[gate] Shell blocked (phase=${p}). Read-only commands + read-only gh/git only. Enter a work phase for gh/git writes; other commands need rules Read.`;
}

const DENY_BOOTSTRAP =
  '[gate] Bootstrap marker is hooks-only. User invokes /bootstrap or /bootstrap off.';

const DENY_CD_ROOT =
  '[reject-cd-root] Shell is already at the workspace root. Remove `cd` and any absolute path to the workspace (including `git -C`). Run commands as-is — e.g. `git add … && git commit …`.';

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

const GIT_READ_SUBS = new Set([
  'status',
  'log',
  'diff',
  'show',
  'rev-parse',
  'ls-files',
  'ls-tree',
  'cat-file',
  'blame',
  'describe',
  'shortlog',
  'name-rev',
  'symbolic-ref',
  'reflog',
  'rev-list',
  'merge-base',
  'check-ignore',
  'check-attr',
  'version',
  'help',
  'for-each-ref',
  'whatchanged',
  'grep',
  'range-diff',
  'var',
  'count-objects',
  'branch',
  'remote',
  'tag',
  'stash',
  'config',
]);

const GH_READ = new Map([
  ['issue', new Set(['list', 'view', 'status'])],
  ['pr', new Set(['list', 'view', 'status', 'checks', 'diff'])],
  ['run', new Set(['list', 'view', 'watch'])],
  ['release', new Set(['list', 'view', 'download'])],
  ['repo', new Set(['view', 'list'])],
  ['label', new Set(['list'])],
  ['project', new Set(['list', 'view', 'item-list', 'field-list'])],
  ['gist', new Set(['list', 'view'])],
  ['search', null],
  ['status', null],
  ['browse', null],
  ['auth', new Set(['status'])],
  ['config', new Set(['get', 'list'])],
]);

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

function isRootMarkdown(root, filePath) {
  if (!filePath) return false;
  const abs = resolve(isAbsolute(filePath) ? filePath : resolve(root, filePath));
  const rel = relative(root, abs);
  if (!rel || rel.startsWith('..') || rel.includes(`..${sep}`)) return false;
  if (rel.includes(sep) || rel.includes('/')) return false;
  return /\.md$/i.test(rel);
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

function checkPathOutsideRoot(root, filePath) {
  if (!filePath || filePath === '/dev/null') return null;
  if (filePath.startsWith('-')) return null;
  const normalized = normalizePath(root, filePath);
  if (isInside(root, normalized)) return null;
  if (allowedExternalRoots().some((p) => isInside(p, normalized))) return null;
  return `[restrict-root] Access outside the project root directory is prohibited: ${filePath}`;
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

function shellCwd(payload, root) {
  if (payload.cwd) return resolve(payload.cwd);
  return root;
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

function stripQuotesAndHeredoc(command) {
  let cleaned = command.replace(/<<-?\s*["']?(\w+)["']?[\s\S]*?\n\s*\1/g, ' ');
  cleaned = cleaned.replace(/(["'])(?:\\.|(?!\1)[^\\])*\1/g, ' ');
  return cleaned;
}

/** `<(...)` / `$(...)` を除去（ネストは浅い繰り返しで落とす） */
function stripProcessAndCommandSubstitutions(command) {
  let cleaned = String(command ?? '');
  for (let i = 0; i < 8; i += 1) {
    const next = cleaned.replace(/<\([^)]*\)/g, ' ').replace(/\$\([^)]*\)/g, ' ');
    if (next === cleaned) break;
    cleaned = next;
  }
  return cleaned;
}

/**
 * allowlist 判定用にシェル構文ノイズを潰す。
 * heredoc / `<(...)` / `$(...)` を落とす。改行は残す（複数行の境界を消すと bypass になる）。
 * 残った `()` はトークン化を壊すのでスペースにする（例: `(echo ok)`）。
 */
function normalizeShellForAllowlist(command) {
  let cleaned = stripQuotesAndHeredoc(String(command ?? ''));
  cleaned = stripProcessAndCommandSubstitutions(cleaned);
  cleaned = cleaned.replace(/[()]/g, ' ');
  return cleaned;
}

function tokenize(segment) {
  return segment.trim().split(/\s+/).filter(Boolean);
}

function firstCommandToken(segment) {
  let s = segment.trim();
  if (!s) return '';
  while (/^[A-Za-z_][A-Za-z0-9_]*=/.test(s)) {
    const sp = s.search(/\s/);
    if (sp === -1) return '';
    s = s.slice(sp).trim();
  }
  const parts = tokenize(s);
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

function tokensAfterCommand(segment, commandName) {
  const parts = tokenize(segment);
  let i = 0;
  while (
    i < parts.length &&
    (parts[i] === 'sudo' || parts[i] === 'command' || parts[i] === 'time')
  ) {
    i += 1;
  }
  while (i < parts.length && /^[A-Za-z_][A-Za-z0-9_]*=/.test(parts[i])) i += 1;

  let cmd = parts[i] || '';
  if (cmd.includes('/')) cmd = basename(cmd);
  if (cmd.toLowerCase() !== commandName) return [];
  i += 1;

  if (commandName === 'git') {
    while (i < parts.length) {
      const p = parts[i];
      if (p === '-C' || p === '--git-dir' || p === '--work-tree' || p === '-c') {
        i += 2;
        continue;
      }
      if (p.startsWith('-')) {
        i += 1;
        continue;
      }
      break;
    }
  }

  if (commandName === 'gh') {
    while (i < parts.length) {
      const p = parts[i];
      if (
        p === '--repo' ||
        p === '-R' ||
        p === '--hostname' ||
        p === '--jq' ||
        p === '-q' ||
        p === '--template' ||
        p === '-t'
      ) {
        i += 2;
        continue;
      }
      if (p.startsWith('-')) {
        i += 1;
        continue;
      }
      break;
    }
  }

  return parts.slice(i);
}

function isGitReadOnly(segment) {
  const args = tokensAfterCommand(segment, 'git');
  if (args.length === 0) return true;
  const sub = args[0].toLowerCase();
  if (!GIT_READ_SUBS.has(sub)) return false;
  const rest = args.slice(1);

  if (sub === 'branch') {
    if (rest.some((a) => /^(-[dDmc]|--delete|--move|--copy|-f|--force)/.test(a))) return false;
    const positionals = rest.filter((a) => !a.startsWith('-'));
    if (positionals.length === 0) return true;
    if (rest.some((a) => /^(-l|--list|-a|--all|-r|--remotes|-v|-vv|--verbose)$/.test(a))) {
      return true;
    }
    return false;
  }

  if (sub === 'remote') {
    if (rest.length === 0) return true;
    const action = rest[0].toLowerCase();
    if (action === 'show' || action === 'get-url') return true;
    if (rest.every((a) => a.startsWith('-'))) return true;
    return false;
  }

  if (sub === 'tag') {
    if (rest.length === 0) return true;
    if (rest.some((a) => /^(-d|--delete|-f|--force|-u|--sign|-s|--annotate|-a|-m)$/.test(a))) {
      return false;
    }
    if (rest.some((a) => a === '-l' || a === '--list')) return true;
    if (rest.every((a) => a.startsWith('-'))) return true;
    return false;
  }

  if (sub === 'stash') {
    if (rest.length === 0) return false;
    const action = rest[0].toLowerCase();
    return action === 'list' || action === 'show';
  }

  if (sub === 'config') {
    return rest.some((a) => a === '--get' || a === '--list' || a === '-l' || a === '--get-regexp');
  }

  return true;
}

function isGhApiReadOnly(rest) {
  if (rest.some((a) => a === '-X' || a === '--method')) return false;
  if (rest.some((a) => /^(POST|PUT|PATCH|DELETE)$/i.test(a))) return false;
  if (rest.some((a) => a === '-f' || a === '-F' || a === '--raw-field' || a === '--input')) {
    return false;
  }
  return true;
}

function isGhReadOnly(segment) {
  const args = tokensAfterCommand(segment, 'gh');
  if (args.length === 0) return true;
  const command = args[0].toLowerCase();

  if (command === 'api') return isGhApiReadOnly(args.slice(1));

  if (!GH_READ.has(command)) return false;
  const allowedSubs = GH_READ.get(command);
  if (allowedSubs === null) return true;

  let i = 1;
  while (i < args.length && args[i].startsWith('-')) i += 1;
  const sub = (args[i] || '').toLowerCase();
  if (!sub) return false;
  return allowedSubs.has(sub);
}

function mentionsStateDir(root, command) {
  const abs = stateDir(root);
  return String(command).includes('.cursor/hooks/state') || String(command).includes(abs);
}

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

/** 1 セグメントが set-label 単体なら true（セグメント内に `&` 等があれば false） */
function isSetLabelShellSegment(segment) {
  const cleaned = String(segment ?? '').trim();
  if (!cleaned) return false;
  // セグメント内の複合は不可。`&` は `&&` より後で判定
  if (/&&|\|\||;|\n|\||&/.test(cleaned)) return false;
  return /(?:^|[\s/])node(?:\s+|$).*\.cursor\/skills\/label\/scripts\/set-label\.mjs(?:\s|$)/.test(
    cleaned,
  );
}

/** コマンド全体が set-label 単体（複合なし）なら true */
function isSetLabelShellCommand(command) {
  const cleaned = normalizeShellForAllowlist(command).trim();
  if (!cleaned) return false;
  if (/&&|\|\||;|\n|\||&/.test(cleaned)) return false;
  return isSetLabelShellSegment(cleaned);
}

function isAllowedWithoutCodeUnlock(command, inWorkPhase) {
  const cleaned = normalizeShellForAllowlist(command);
  const segments = cleaned
    .split(/&&|\|\||;|\n|\|/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (segments.length === 0) return true;
  return segments.every((seg) => {
    // set-label セグメントは常時 OK。残りは従来どおり
    if (isSetLabelShellSegment(seg)) return true;
    const cmd = firstCommandToken(seg);
    if (!cmd) return true;
    if (READONLY_CMDS.has(cmd)) return true;
    if (cmd === 'git') return inWorkPhase || isGitReadOnly(seg);
    if (cmd === 'gh') return inWorkPhase || isGhReadOnly(seg);
    return false;
  });
}

function denyOutsidePathsInCommand(root, command) {
  for (const p of extractPathsFromCommand(command)) {
    const err = checkPathOutsideRoot(root, p);
    if (err) return err;
  }
  return null;
}

function handleShell(payload, root, state, unlocked, inWorkPhase) {
  const command = String(payload.command ?? payload.tool_input?.command ?? '');

  if (isShellWriteToState(root, command)) return deny(DENY_STATE);
  if (isShellWriteToBootstrapMarker(root, command)) return deny(DENY_BOOTSTRAP);
  if (isBootstrapActive(root)) return allow();

  const cwd = shellCwd(payload, root);
  if (cdsToProjectRoot(command, cwd, root)) return deny(DENY_CD_ROOT);

  const outsideErr = denyOutsidePathsInCommand(root, command);
  if (outsideErr) return deny(outsideErr);

  if (commandIncludesGitCommit(command) && isReviewBlocking(state)) {
    return deny(denyReviewMessage(normalizeReview(state.review).files));
  }

  if (
    isSpecFlowPhase(state.phase) &&
    !isIssueReady(state) &&
    commandIncludesGhIssueMutation(command)
  ) {
    return deny(denyIssueMessage(state));
  }

  // label script はどのフェーズでも許可（state は script が書く）
  if (isSetLabelShellCommand(command)) return allow();

  if (unlocked) return allow();
  if (isAllowedWithoutCodeUnlock(command, inWorkPhase)) return allow();
  return deny(denyShellMessage(state.phase));
}

export async function handleGate(payload) {
  logHookIds(payload, 'gate-core');
  const root = workspaceRoot(payload);
  const state = loadState(root, conversationId(payload));
  const unlocked = isUnlocked(state);
  const inWorkPhase = WORK_PHASES.has(state.phase);
  const event = payload.hook_event_name ?? '';
  const toolName = payload.tool_name ?? '';

  const isShellEvent =
    event === 'beforeShellExecution' || toolName === 'Shell' || toolName === 'Bash';

  if (isShellEvent) {
    return handleShell(payload, root, state, unlocked, inWorkPhase);
  }

  if (event === 'beforeReadFile') {
    const err = checkPathOutsideRoot(root, payload.file_path);
    if (err) return deny(err);
    return allow();
  }

  const toolInput = payload.tool_input ?? {};
  const fileArg = fileArgFromToolInput(toolInput) ?? payload.file_path;
  if (fileArg) {
    const abs = resolve(
      isAbsolute(String(fileArg)) ? String(fileArg) : resolve(root, String(fileArg)),
    );
    if (isUnderStateDir(root, abs)) return deny(DENY_STATE);
    if (isBootstrapMarkerPath(root, abs)) return deny(DENY_BOOTSTRAP);
    const outsideErr = checkPathOutsideRoot(root, String(fileArg));
    if (outsideErr) return deny(outsideErr);
  }

  if (toolName === 'Shell' || toolName === 'Bash') {
    const command = String(toolInput.command ?? '');
    const outsideErr = denyOutsidePathsInCommand(root, command);
    if (outsideErr) return deny(outsideErr);
  }

  // Read は解錠条件にしない（handshake と race しない）。ロックは編集系のみ。
  if (toolName === 'Read' || toolName === 'ReadFile') return allow();

  if (isBootstrapActive(root)) return allow();

  if (unlocked) {
    if (WRITE_TOOLS.has(toolName) && fileArg) {
      const required = requiredRefsForPath(root, String(fileArg));
      const missing = missingRefs(state.read?.refs ?? [], required);
      if (missing.length > 0) return deny(denyRefsMessage(missing));
    }
    return allow();
  }

  if (fileArg && isRootMarkdown(root, String(fileArg))) return allow();
  return deny(denyCodeMessage(state.phase));
}

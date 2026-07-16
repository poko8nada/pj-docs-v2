#!/usr/bin/env node
/**
 * phase + implement Read まで、プロダクト／ハーネスのコード編集を止める。
 * 対象: preToolUse（Write|StrReplace|Delete|EditNotebook）、beforeShellExecution。
 * ルート直下 *.md は常時許可。
 * Shell:
 *   - discussion → 読み取り系 + gh/git の read サブコマンドのみ
 *   - 作業フェーズ入場後 → gh/git は解放（implement 不要）。その他は implement まで制限
 * `.cursor/hooks/state/**` は解禁後も常時編集禁止（Read は可）。
 * bootstrap: `.cursor/hooks/.bootstrap` または CURSOR_GATE_BOOTSTRAP=1 → 先頭で allow（state/マーカー編集は除く）。
 */
import { basename, isAbsolute, relative, resolve, sep } from 'node:path';
import {
  isBootstrapActive,
  isBootstrapMarkerPath,
  isShellWriteToBootstrapMarker,
} from './_bootstrap.mjs';
import {
  conversationId,
  isUnderStateDir,
  isUnlocked,
  loadState,
  stateDir,
  WORK_PHASES,
  workspaceRoot,
} from './_state.mjs';

const DENY_CODE =
  '[gate] Code edits require a work phase (/spec|/design|/forge|/refine|/chore) and Read of .cursor/skills/implement/SKILL.md. Default phase is discussion (no code).';

const DENY_SHELL =
  '[gate] Shell blocked. In discussion: read-only commands + read-only gh/git only. After a work phase: gh/git are allowed; other commands need implement Read.';

const DENY_STATE =
  '[gate] Gate state files are hooks-only. Read is allowed; do not edit `.cursor/hooks/state/**`.';

const DENY_BOOTSTRAP =
  '[gate] Bootstrap marker is hooks-only. User invokes /bootstrap or /bootstrap off.';

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

/** discussion 中に許可する git サブコマンド（読み取り） */
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
  'branch', // 作成・削除は isGitReadOnly で除外
  'remote', // 変更系は isGitReadOnly で除外
  'tag', // 一覧のみ
  'stash', // list / show のみ
  'config', // --get / --list のみ
]);

/**
 * discussion 中に許可する gh の (command → subcommands)。
 * subcommands が null ならその command 配下をすべて許可（例: search）。
 */
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

function tokenize(segment) {
  return segment.trim().split(/\s+/).filter(Boolean);
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

/** git / gh のグローバルオプションを飛ばしてトークン列を返す */
function tokensAfterCommand(segment, commandName) {
  const parts = tokenize(segment);
  let i = 0;
  while (
    i < parts.length &&
    (parts[i] === 'sudo' || parts[i] === 'command' || parts[i] === 'time')
  ) {
    i += 1;
  }
  // 環境変数代入
  while (i < parts.length && /^[A-Za-z_][A-Za-z0-9_]*=/.test(parts[i])) i += 1;

  let cmd = parts[i] || '';
  if (cmd.includes('/')) cmd = basename(cmd);
  if (cmd.toLowerCase() !== commandName) return [];
  i += 1;

  // git グローバルオプション
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

  // gh グローバルオプション（値付き）
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
  if (args.length === 0) return true; // bare `git` → help
  const sub = args[0].toLowerCase();
  if (!GIT_READ_SUBS.has(sub)) return false;
  const rest = args.slice(1);

  if (sub === 'branch') {
    // 削除・改名・強制などは不可。位置引数あり＝作成扱い。
    if (rest.some((a) => /^(-[dDmc]|--delete|--move|--copy|-f|--force)/.test(a))) return false;
    const positionals = rest.filter((a) => !a.startsWith('-'));
    if (positionals.length === 0) return true;
    // `--list` / `-l` / `-a` / `-r` 付きのパターンは一覧
    if (rest.some((a) => /^(-l|--list|-a|--all|-r|--remotes|-v|-vv|--verbose)$/.test(a))) {
      return true;
    }
    return false;
  }

  if (sub === 'remote') {
    if (rest.length === 0) return true;
    const action = rest[0].toLowerCase();
    if (action === 'show' || action === 'get-url') return true;
    if (rest.every((a) => a.startsWith('-'))) return true; // -v など
    return false;
  }

  if (sub === 'tag') {
    if (rest.length === 0) return true;
    if (rest.some((a) => /^(-d|--delete|-f|--force|-u|--sign|-s|--annotate|-a|-m)$/.test(a))) {
      return false;
    }
    // -l / --list またはフラグのみ
    if (rest.some((a) => a === '-l' || a === '--list')) return true;
    if (rest.every((a) => a.startsWith('-'))) return true;
    return false; // `git tag v1` は作成
  }

  if (sub === 'stash') {
    if (rest.length === 0) return false; // bare stash = push
    const action = rest[0].toLowerCase();
    return action === 'list' || action === 'show';
  }

  if (sub === 'config') {
    return rest.some((a) => a === '--get' || a === '--list' || a === '-l' || a === '--get-regexp');
  }

  return true;
}

function isGhApiReadOnly(rest) {
  // `gh api …` — GET 相当のみ。-X POST 等や明示メソッドは不可。
  if (rest.some((a) => a === '-X' || a === '--method')) return false;
  if (rest.some((a) => /^(POST|PUT|PATCH|DELETE)$/i.test(a))) return false;
  // フィールド送信は mutation 扱い
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

  // サブコマンドを探す（フラグを飛ばす）
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

/**
 * コード未解禁時の Shell 許可。
 * - discussion: 読み取り系 + gh/git read のみ
 * - 作業フェーズ: 読み取り系 + gh/git 全許可
 */
function isAllowedWithoutCodeUnlock(command, inWorkPhase) {
  const cleaned = stripQuotesAndHeredoc(String(command ?? ''));
  const segments = cleaned
    .split(/&&|\|\||;|\n|\|/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (segments.length === 0) return true;
  return segments.every((seg) => {
    const cmd = firstCommandToken(seg);
    if (!cmd) return true;
    if (READONLY_CMDS.has(cmd)) return true;
    if (cmd === 'git') return inWorkPhase || isGitReadOnly(seg);
    if (cmd === 'gh') return inWorkPhase || isGhReadOnly(seg);
    return false;
  });
}

async function main() {
  const payload = await readStdinJson();
  const root = workspaceRoot(payload);
  const id = conversationId(payload);
  const state = loadState(root, id);
  const unlocked = isUnlocked(state);
  const inWorkPhase = WORK_PHASES.has(state.phase);
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
    if (isShellWriteToBootstrapMarker(root, command)) {
      return deny(DENY_BOOTSTRAP);
    }
    if (isBootstrapActive(root)) return allow();
    if (unlocked) return allow();
    if (isAllowedWithoutCodeUnlock(command, inWorkPhase)) return allow();
    return deny(DENY_SHELL);
  }

  // ファイル変更系: state / bootstrap マーカーは常時 deny
  const toolInput = payload.tool_input ?? {};
  const fileArg = fileArgFromToolInput(toolInput) ?? payload.file_path;
  if (fileArg) {
    const abs = resolve(
      isAbsolute(String(fileArg)) ? String(fileArg) : resolve(root, String(fileArg)),
    );
    if (isUnderStateDir(root, abs)) return deny(DENY_STATE);
    if (isBootstrapMarkerPath(root, abs)) return deny(DENY_BOOTSTRAP);
  }

  if (isBootstrapActive(root)) return allow();
  if (unlocked) return allow();
  if (fileArg && isRootMarkdown(root, String(fileArg))) return allow();
  return deny(DENY_CODE);
}

main().catch((error) => {
  deny(`[gate] ${error instanceof Error ? error.message : String(error)}`);
});

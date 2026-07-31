/**
 * Pre-commit reviewer gate — path rules, Task 識別、review.files + diff の Task 注入、
 * commit 時の子 transcript PASS クリア。
 */
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { homedir } from 'node:os';
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { isBootstrapMarkerPath } from './bootstrap.mjs';
import { formatDeny } from './deny-format.mjs';
import { isUnderStateDir } from './state.mjs';

/** コード＋CSS＋HTMLのみ（md/json/yaml は Issue 下書き等で gate を汚さない） */
const REVIEWABLE_EXT = /\.(ts|tsx|js|jsx|mjs|cjs|css|html)$/i;

/** path ごとの diff／新規本文のソフト上限 */
export const REVIEW_DIFF_MAX_PER_FILE = 8000;
/** 注入全体のソフト上限 */
export const REVIEW_DIFF_MAX_TOTAL = 48000;

/** @param {string[]} files */
export function denyReviewMessage(files) {
  const list = Array.isArray(files) && files.length > 0 ? files.join(', ') : '(none)';
  return formatDeny({
    tag: 'gate-review',
    why: `review.files is non-empty (unreviewed): ${list}.`,
    next: [
      'Run `/pre-commit-reviewer` (need `REVIEW: PASS` in the child transcript).',
      'Then stop or `git commit` (`git add` order does not matter).',
    ],
    doNot: [
      'Retry `git commit` unchanged while review.files is non-empty.',
      'Skip the reviewer or invent a commit flag to bypass hooks.',
    ],
  });
}

export const REVIEW_INJECT_MARKER = '[harness-review]';

/** pre-commit-reviewer 相当の Task / subagent か */
export function isPreCommitReviewerContext(payload) {
  const input = payload.tool_input ?? {};
  const type = String(payload.subagent_type ?? input.subagent_type ?? input.subagentType ?? '');
  const task = String(
    payload.task ?? payload.description ?? input.description ?? input.prompt ?? input.task ?? '',
  );
  return (
    type === 'pre-commit-reviewer' ||
    type === 'reviewer' ||
    /\bpre-commit-reviewer\b|\bpre-commit review\b/i.test(task)
  );
}

function relPosix(root, filePath) {
  if (!filePath) return null;
  const abs = resolve(isAbsolute(filePath) ? filePath : resolve(root, String(filePath)));
  const rel = relative(root, abs);
  if (!rel || rel.startsWith('..') || rel.includes(`..${sep}`)) return null;
  return rel.split(sep).join('/');
}

/** review.files 蓄積から除外（state / bootstrap / smoke 一時） */
export function isExcludedFromReviewTrack(root, filePath) {
  if (!filePath) return true;
  const abs = resolve(isAbsolute(filePath) ? filePath : resolve(root, String(filePath)));
  if (isUnderStateDir(root, abs)) return true;
  if (isBootstrapMarkerPath(root, abs)) return true;
  const posix = relPosix(root, filePath);
  if (!posix) return true;
  if (posix.startsWith('.cursor/hooks/.smoke-tmp/')) return true;
  return false;
}

/** 編集追跡対象（harness / product 一律。path 特定に git diff は使わない） */
export function isReviewablePath(root, filePath) {
  if (isExcludedFromReviewTrack(root, filePath)) return false;
  const posix = relPosix(root, filePath);
  if (!posix) return false;
  return REVIEWABLE_EXT.test(posix);
}

function gitRun(root, args) {
  return spawnSync('git', args, {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 2 * 1024 * 1024,
  });
}

/**
 * @returns {{ kind: 'diff' | 'new' | 'empty' | 'error', body: string }}
 */
export function collectReviewDiff(root, relPath) {
  const posix = String(relPath).split(sep).join('/');
  const abs = resolve(root, posix);

  // git diff: exit 0 = 差分なし, 1 = 差分あり, それ以外 = エラー
  const diffRun = gitRun(root, ['diff', 'HEAD', '--', posix]);
  if (diffRun.error) {
    return { kind: 'error', body: `git diff failed: ${diffRun.error.message}` };
  }
  const diffCode = Number(diffRun.status ?? 0);
  if (diffCode !== 0 && diffCode !== 1) {
    const err = String(diffRun.stderr ?? '').trim() || `exit ${diffCode}`;
    return { kind: 'error', body: `git diff failed: ${err}` };
  }
  const diff = String(diffRun.stdout ?? '').trimEnd();
  if (diff) return { kind: 'diff', body: diff };

  const lsRun = gitRun(root, ['ls-files', '--', posix]);
  if (lsRun.error) {
    return { kind: 'error', body: `git ls-files failed: ${lsRun.error.message}` };
  }
  if (Number(lsRun.status ?? 0) !== 0) {
    const err = String(lsRun.stderr ?? '').trim() || `exit ${lsRun.status}`;
    return { kind: 'error', body: `git ls-files failed: ${err}` };
  }
  const tracked = String(lsRun.stdout ?? '').trim();
  if (!tracked && existsSync(abs)) {
    try {
      return { kind: 'new', body: readFileSync(abs, 'utf8') };
    } catch (e) {
      return { kind: 'error', body: `read failed: ${e instanceof Error ? e.message : String(e)}` };
    }
  }
  return { kind: 'empty', body: '' };
}

function truncateBlock(text, max, label) {
  if (text.length <= max) return text;
  const kept = Math.max(0, max - 80);
  return (
    text.slice(0, kept) +
    `\n… [truncated ${text.length - kept} chars from ${label}; Read the file only if critical]\n`
  );
}

/**
 * @param {string} root
 * @param {string[]} files
 */
export function buildReviewTaskInjection(root, files) {
  if (!Array.isArray(files) || files.length === 0) return null;

  const lines = [
    `${REVIEW_INJECT_MARKER} Review the following changes (from review.files).`,
    'Focus on the injected diff / new-file content. Do not run git. Do not Read whole files unless the injection is truncated and critical context is missing.',
    '',
  ];

  let total = lines.join('\n').length;
  for (const f of files) {
    const { kind, body } = collectReviewDiff(root, f);
    let section;
    if (kind === 'diff') {
      const text = truncateBlock(body, REVIEW_DIFF_MAX_PER_FILE, f);
      section = `### ${f}\n\`\`\`diff\n${text}\n\`\`\`\n`;
    } else if (kind === 'new') {
      const text = truncateBlock(body, REVIEW_DIFF_MAX_PER_FILE, f);
      section = `### ${f}\n(new or untracked — full content)\n\`\`\`\n${text}\n\`\`\`\n`;
    } else if (kind === 'error') {
      section = `### ${f}\n(git error — do not assume unchanged)\n\`\`\`\n${body}\n\`\`\`\n`;
    } else {
      section = `### ${f}\n(no diff vs HEAD — unchanged or missing; skip unless you must verify deletion)\n`;
    }

    if (total + section.length > REVIEW_DIFF_MAX_TOTAL) {
      lines.push(
        `… [omitted remaining paths; total injection cap ${REVIEW_DIFF_MAX_TOTAL} chars]`,
        '',
      );
      break;
    }
    lines.push(section);
    total += section.length;
  }

  return lines.join('\n');
}

/** preToolUse Task 用: review.files + diff を prompt / description / task に前置 */
export function injectReviewFilesIntoTaskInput(toolInput, root, files) {
  const block = buildReviewTaskInjection(root, files);
  if (!block) return null;
  const input = toolInput && typeof toolInput === 'object' ? { ...toolInput } : {};
  const original = String(input.prompt ?? input.description ?? input.task ?? '');
  const merged = `${block}${original}`;
  // ランタイムがどれを見るかわからないので共通フィールド全部に書く
  input.prompt = merged;
  input.description = merged;
  input.task = merged;
  return input;
}

function shellSegments(command) {
  const cleaned = String(command ?? '')
    .replace(/<<-?\s*["']?(\w+)["']?[\s\S]*?\n\s*\1/g, ' ')
    .replace(/(["'])(?:\\.|(?!\1)[^\\])*\1/g, ' ');
  return cleaned
    .split(/&&|\|\||;|\n|\|/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** `git commit` を含むか（segment 単位） */
export function commandIncludesGitCommit(command) {
  return shellSegments(command).some((seg) => /\bgit\b/.test(seg) && /\bcommit\b/.test(seg));
}

/** Cursor の projects スラッグ（`/Users/a/_b` → `Users-a-b`。`_` は除去） */
export function cursorProjectSlug(root) {
  return resolve(root)
    .replace(/^[\\/]+/, '')
    .replace(/_/g, '')
    .replace(/[:\\/]+/g, '-');
}

/**
 * agent-transcripts 置き場。
 * テストは CURSOR_GATE_TRANSCRIPTS_DIR で上書き。
 */
export function agentTranscriptsDir(root) {
  const override = process.env.CURSOR_GATE_TRANSCRIPTS_DIR;
  if (override && String(override).trim()) return resolve(String(override).trim());
  return join(homedir(), '.cursor', 'projects', cursorProjectSlug(root), 'agent-transcripts');
}

/** 本文中の最後の `REVIEW: PASS|GAPS`（大文字化）。無ければ null */
export function lastReviewVerdict(text) {
  // JSONL 生文字列では改行が `\n` エスケープのため、先頭 `\b` は使わない
  const re = /REVIEW:\s*(PASS|GAPS)\b/gi;
  let last = null;
  let m;
  while ((m = re.exec(String(text ?? ''))) !== null) {
    last = m[1].toUpperCase();
  }
  return last;
}

/**
 * dirtyAt → スキャン下限 ms。
 * null/不正は 0（移行: 旧 state に dirtyAt が無い場合でも PASS で clear できる）。
 */
export function reviewDirtySinceMs(dirtyAt) {
  if (dirtyAt == null || String(dirtyAt).trim() === '') return 0;
  const ms = Date.parse(String(dirtyAt));
  return Number.isFinite(ms) ? ms : 0;
}

/**
 * 子 transcript がこの workspace の pre-commit reviewer 試行か（verdict は見ない）。
 * - 絶対 path 必須
 * - 署名: `pre-commit-reviewer` / `[harness-review]` / (`Full Repository Path:` + `Diff:`)
 */
export function isReviewerTranscriptText(root, text) {
  const body = String(text ?? '');
  const rootAbs = resolve(root);
  if (!body.includes(rootAbs)) return false;

  const hasType = /\bpre-commit-reviewer\b/i.test(body);
  const hasHarness = body.includes(REVIEW_INJECT_MARKER);
  // JSONL 生文字列では `\nDiff:` となり `\bDiff` が失敗するため単語境界は使わない
  const hasPromptShape = /Full Repository Path:/i.test(body) && /Diff:/i.test(body);
  return hasType || hasHarness || hasPromptShape;
}

/** reviewer 試行かつ最終 verdict が PASS */
export function isReviewPassTranscriptText(root, text) {
  return isReviewerTranscriptText(root, text) && lastReviewVerdict(text) === 'PASS';
}

/**
 * dirtyAt 以降の unused reviewer 子 jsonl のうち **最新 mtime** が PASS ならその path。
 * 親 conversation / used フラグ付きは除外。
 * @returns {string | null}
 */
export function findReviewPassTranscript(root, dirtyAt, excludeId = null) {
  const dirtyMs = reviewDirtySinceMs(dirtyAt);

  const dir = agentTranscriptsDir(root);
  if (!existsSync(dir)) return null;

  let names;
  try {
    names = readdirSync(dir);
  } catch {
    return null;
  }

  /** @type {{ mtimeMs: number, jsonl: string, text: string } | null} */
  let latest = null;

  for (const name of names) {
    if (excludeId && name === excludeId) continue;
    const jsonl = join(dir, name, `${name}.jsonl`);
    if (!existsSync(jsonl)) continue;
    if (isReviewPassUsed(jsonl)) continue;

    let st;
    try {
      st = statSync(jsonl);
    } catch {
      continue;
    }
    if (st.mtimeMs < dirtyMs) continue;

    let text;
    try {
      text = readFileSync(jsonl, 'utf8');
    } catch {
      continue;
    }
    if (!isReviewerTranscriptText(root, text)) continue;

    if (!latest || st.mtimeMs >= latest.mtimeMs) {
      latest = { mtimeMs: st.mtimeMs, jsonl, text };
    }
  }

  if (!latest) return null;
  if (lastReviewVerdict(latest.text) !== 'PASS') return null;
  return latest.jsonl;
}

/** jsonl 隣の使い済みフラグ path（`<id>.jsonl` → `<id>.harness-pass-used`） */
export function reviewPassUsedPath(jsonlPath) {
  const dir = dirname(jsonlPath);
  const id = basename(String(jsonlPath), '.jsonl');
  return join(dir, `${id}.harness-pass-used`);
}

export function isReviewPassUsed(jsonlPath) {
  try {
    return existsSync(reviewPassUsedPath(jsonlPath));
  } catch {
    return false;
  }
}

/** PASS を使い捨てた印（jsonl は残す） */
export function markReviewPassUsed(jsonlPath) {
  const flag = reviewPassUsedPath(jsonlPath);
  writeFileSync(flag, '', 'utf8');
  return flag;
}

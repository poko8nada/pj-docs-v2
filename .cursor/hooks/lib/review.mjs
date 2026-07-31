/**
 * Pre-commit reviewer gate — path rules, Task 識別、review.files + diff の Task 注入。
 */
import { existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { isAbsolute, relative, resolve, sep } from 'node:path';
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
      'Run `/pre-commit-reviewer` to clear review.files.',
      'Then `git commit` (`git add` order does not matter).',
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

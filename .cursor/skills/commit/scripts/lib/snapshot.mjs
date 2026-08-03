import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';

// 設定・実装ファイルをレビュー対象にし、Markdownは対象外として扱う。
export const REVIEWABLE_EXTENSIONS = Object.freeze([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.css',
  '.html',
  '.json',
  '.yaml',
  '.yml',
]);

// 既存差分はファイル単位、新規ファイルは全体単位で制限し、hashは全stage内容から計算する。
export const REVIEW_DIFF_MAX_PER_FILE = 10_000;
export const REVIEW_DIFF_MAX_TOTAL = 60_000;

export function collectStagedSnapshot(root, { includeEntries = true } = {}) {
  const pathsResult = runGit(root, [
    'diff',
    '--cached',
    '--name-only',
    '--no-renames',
    '-z',
    'HEAD',
    '--',
  ]);
  if (!pathsResult.ok) return errorSnapshot(pathsResult.message);

  const paths = parseNullSeparatedPaths(pathsResult.stdout);
  const diffResult = runGit(root, ['diff', '--cached', '--no-renames', '--binary', 'HEAD', '--']);
  if (!diffResult.ok) return errorSnapshot(diffResult.message, paths);

  const hash = hashStagedSnapshot(paths, diffResult.stdout);
  const reviewablePaths = paths.filter(isReviewablePath);
  const entries = [];

  if (includeEntries) {
    for (const path of reviewablePaths) {
      const entry = collectStagedEntry(root, path);
      if (!entry.ok) return errorSnapshot(entry.message, paths);
      entries.push({ path, body: entry.body, isNewFile: entry.isNewFile });
    }
  }

  return {
    ok: true,
    kind: paths.length === 0 ? 'empty' : 'snapshot',
    hash,
    paths,
    reviewablePaths,
    entries,
  };
}

export function buildReviewPayload(root, snapshot, note = null) {
  if (!snapshot?.ok || snapshot.reviewablePaths.length === 0) {
    return { payload: null, truncated: false };
  }

  const reviewNote = String(note ?? '').trim();
  const lines = [
    '[commit-review-payload]',
    `Full Repository Path: ${resolve(root)}`,
    'Commit Candidate: staged Git index',
    'Review only the supplied diff text. Do not run git or inspect unrelated files.',
  ];
  if (reviewNote) lines.push('', 'Accepted exclusions:', reviewNote);
  lines.push('', 'Reviewable Files:', ...snapshot.reviewablePaths.map((path) => `- ${path}`), '');
  let total = lines.join('\n').length;
  let truncated = total > REVIEW_DIFF_MAX_TOTAL;

  for (const entry of snapshot.entries) {
    const built = buildEntrySection(entry);
    if (total + built.section.length > REVIEW_DIFF_MAX_TOTAL) {
      lines.push(
        `… [omitted remaining reviewable files; total payload cap ${REVIEW_DIFF_MAX_TOTAL} characters]`,
        '',
      );
      truncated = true;
      break;
    }
    lines.push(built.section);
    total += built.section.length;
    truncated ||= built.truncated;
  }

  return { payload: lines.join('\n'), truncated };
}

export function isReviewablePath(path) {
  const normalized = String(path).replaceAll('\\', '/').toLowerCase();
  return REVIEWABLE_EXTENSIONS.some((extension) => normalized.endsWith(extension));
}

export function runGit(root, args, { input = null } = {}) {
  const options = {
    cwd: root,
    encoding: null,
    maxBuffer: 32 * 1024 * 1024,
  };
  if (input !== null) options.input = input;
  const result = spawnSync('git', args, options);

  if (result.error) {
    return { ok: false, message: `git ${args[0]} failed: ${result.error.message}` };
  }
  if (Number(result.status ?? 0) !== 0) {
    return {
      ok: false,
      message: `git ${args[0]} failed: ${bufferText(result.stderr).trim() || `exit ${result.status}`}`,
    };
  }
  return {
    ok: true,
    stdout: result.stdout ?? Buffer.alloc(0),
    stderr: result.stderr ?? Buffer.alloc(0),
  };
}

function collectStagedEntry(root, path) {
  const result = runGit(root, ['diff', '--cached', '--no-renames', '--binary', 'HEAD', '--', path]);
  if (!result.ok) return result;
  const body = bufferText(result.stdout);
  return { ok: true, body, isNewFile: /^new file mode /m.test(body) };
}

function hashStagedSnapshot(paths, diff) {
  const pathBlock = Buffer.from(`staged\0${paths.join('\0')}\0`, 'utf8');
  const serialized = Buffer.concat([pathBlock, diff]);
  return `sha256:${createHash('sha256').update(serialized).digest('hex')}`;
}

function buildEntrySection(entry) {
  const limit = entry.isNewFile ? REVIEW_DIFF_MAX_TOTAL : REVIEW_DIFF_MAX_PER_FILE;
  const { text, truncated } = truncateText(entry.body, limit, entry.path);
  const notice = truncated ? '\n[This file section was truncated.]\n' : '';
  return {
    section: `### ${entry.path}\n\`\`\`diff\n${text}${notice}\n\`\`\`\n`,
    truncated,
  };
}

function truncateText(text, limit, label) {
  if (text.length <= limit) return { text, truncated: false };
  const marker = `\n… [truncated ${text.length - limit} characters from ${label}]\n`;
  const kept = Math.max(0, limit - marker.length);
  return { text: `${text.slice(0, kept)}${marker}`, truncated: true };
}

function parseNullSeparatedPaths(buffer) {
  return [...new Set(bufferText(buffer).split('\0').filter(Boolean))].toSorted();
}

function errorSnapshot(message, paths = []) {
  return {
    ok: false,
    kind: 'error',
    message,
    hash: null,
    paths,
    reviewablePaths: paths.filter(isReviewablePath),
    entries: [],
  };
}

function bufferText(value) {
  return Buffer.isBuffer(value) ? value.toString('utf8') : String(value ?? '');
}

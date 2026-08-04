import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { isAbsolute, relative, resolve } from 'node:path';

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
      entries.push({ path, body: entry.body });
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

export function buildReviewPayload(root, snapshot, note = null, options = {}) {
  const selectedPaths = options.reviewablePaths ?? snapshot?.reviewablePaths ?? [];
  const contextPaths = options.contextPaths ?? [];
  if (!snapshot?.ok || selectedPaths.length === 0) {
    return { payload: null, complete: true, missingPaths: [] };
  }

  const reviewNote = String(note ?? '').trim();
  const entriesByPath = new Map((snapshot.entries ?? []).map((entry) => [entry.path, entry]));
  const entries = selectedPaths.map((path) => entriesByPath.get(path)).filter(Boolean);
  const missingPaths = selectedPaths.filter((path) => !entriesByPath.has(path));
  if (missingPaths.length > 0) {
    return { payload: null, complete: false, missingPaths };
  }
  const lines = [
    '[commit-review-payload]',
    `Full Repository Path: ${resolve(root)}`,
    'Commit Candidate: staged Git index',
    'Review the supplied diff text. Read only explicitly listed Context Files when necessary. Do not run git or inspect unrelated files.',
  ];
  if (reviewNote) lines.push('', 'Review notes:', reviewNote);
  if (contextPaths.length > 0) {
    lines.push('', 'Context Files:', ...contextPaths.map((path) => `- ${path}`));
  }
  lines.push('', 'Reviewable Files:', ...selectedPaths.map((path) => `- ${path}`), '');

  for (const entry of entries) lines.push(buildEntrySection(entry));

  return { payload: lines.join('\n'), complete: true, missingPaths: [] };
}

export function isReviewablePath(path) {
  const normalized = String(path).replaceAll('\\', '/').toLowerCase();
  return REVIEWABLE_EXTENSIONS.some((extension) => normalized.endsWith(extension));
}

export function validateContextPaths(root, contextPaths = [], stagedPaths = []) {
  const normalized = [];
  const staged = new Set(stagedPaths.map(normalizeRepoPath));

  for (const rawPath of contextPaths) {
    const path = normalizeRepoPath(rawPath);
    const hasGlobCharacter = ['?', '*', '{', '}', '[', ']'].some((character) =>
      path.includes(character),
    );
    const segments = path.split('/');
    if (
      !path ||
      isAbsolute(path) ||
      hasGlobCharacter ||
      segments.some((segment) => segment === '' || segment === '.' || segment === '..')
    ) {
      return { ok: false, message: `Context path must be a relative file path: ${rawPath}` };
    }
    const absolute = resolve(root, path);
    const relativePath = relative(resolve(root), absolute).replaceAll('\\', '/');
    if (!relativePath || relativePath.startsWith('..') || relativePath.includes('/../')) {
      return { ok: false, message: `Context path is outside the repository: ${rawPath}` };
    }
    if (normalized.includes(path)) {
      return { ok: false, message: `Context path is listed more than once: ${path}` };
    }
    if (staged.has(path)) {
      return { ok: false, message: `Context path is also a staged path: ${path}` };
    }

    const tracked = runGit(root, ['ls-files', '--error-unmatch', '--', path]);
    if (!tracked.ok) {
      return { ok: false, message: `Context path is not a tracked file: ${path}` };
    }
    const changed = runGit(root, ['diff', '--name-only', 'HEAD', '--', path]);
    if (!changed.ok) return changed;
    if (bufferText(changed.stdout).trim()) {
      return { ok: false, message: `Context path has uncommitted changes: ${path}` };
    }
    normalized.push(path);
  }

  return { ok: true, paths: normalized };
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
  return { ok: true, body };
}

function hashStagedSnapshot(paths, diff) {
  const pathBlock = Buffer.from(`staged\0${paths.join('\0')}\0`, 'utf8');
  const serialized = Buffer.concat([pathBlock, diff]);
  return `sha256:${createHash('sha256').update(serialized).digest('hex')}`;
}

function buildEntrySection(entry) {
  return `### ${entry.path}\n\`\`\`diff\n${entry.body}\n\`\`\`\n`;
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

function normalizeRepoPath(path) {
  return String(path ?? '')
    .trim()
    .replaceAll('\\', '/');
}

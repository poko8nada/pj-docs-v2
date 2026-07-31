/**
 * 編集後チェック — format/lint（広い）と typecheck（ts/tsx のみ）。
 */
import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';
import { formatDeny } from './deny-format.mjs';
import { isExcludedFromReviewTrack } from './review.mjs';

const FORMAT_LINT_EXT = /\.(ts|tsx|js|jsx|mjs|cjs)$/i;
const TYPECHECK_EXT = /\.(ts|tsx)$/i;

/** format / lint / typecheck に必要なルート依存パッケージ */
const CHECK_TOOL_PACKAGES = ['oxfmt', 'oxlint', 'tsc-files', 'typescript'];
const CHECK_COMMAND_TIMEOUT_MS = 30_000;

function relPosix(root, filePath) {
  if (!filePath) return null;
  const abs = resolve(isAbsolute(filePath) ? filePath : resolve(root, String(filePath)));
  const rel = relative(root, abs);
  if (!rel || rel.startsWith('..') || rel.includes(`..${sep}`)) return null;
  return rel.split(sep).join('/');
}

/** format/lint 対象（harness 含む。state/bootstrap 除外） */
export function isCheckablePath(root, filePath) {
  if (isExcludedFromReviewTrack(root, filePath)) return false;
  const posix = relPosix(root, filePath);
  if (!posix) return false;
  return FORMAT_LINT_EXT.test(posix);
}

/** typecheck 対象（ts/tsx のみ） */
export function isTypecheckPath(root, filePath) {
  if (isExcludedFromReviewTrack(root, filePath)) return false;
  const posix = relPosix(root, filePath);
  if (!posix) return false;
  return TYPECHECK_EXT.test(posix);
}

/** format / lint / typecheck のローカル実行に必要な依存があるか。 */
export function isCheckToolingReady(root) {
  return CHECK_TOOL_PACKAGES.every((name) => existsSync(join(root, 'node_modules', name)));
}

function hasLocalPackages(root, packages) {
  return packages.every((name) => existsSync(join(root, 'node_modules', name)));
}

function runCommand(root, args) {
  return spawnSync('pnpm', args, {
    cwd: root,
    encoding: 'utf8',
    timeout: CHECK_COMMAND_TIMEOUT_MS,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function commandFailure(label, result) {
  const output = [
    result.stdout,
    result.stderr,
    result.error?.message,
    result.signal ? `terminated by ${result.signal}` : '',
  ]
    .filter(Boolean)
    .join('\n')
    .trim();
  return [`${label} failed:`, output].filter(Boolean).join('\n');
}

function runCheckCommand(root, { label, localArgs, files }) {
  const result = runCommand(root, [...localArgs, ...files]);
  if (result.status === 0) return null;
  return commandFailure(label, result);
}

function existingRelPaths(root, relPaths) {
  return relPaths.filter((rel) => rel && existsSync(join(root, rel)));
}

function filterByExt(relPaths, extRe) {
  return relPaths.filter((rel) => extRe.test(rel));
}

function missingTooling(root, formatLintFiles, typecheckFiles) {
  const missing = [];
  if (formatLintFiles.length > 0) {
    if (!hasLocalPackages(root, ['oxfmt'])) missing.push('oxfmt');
    if (!hasLocalPackages(root, ['oxlint'])) missing.push('oxlint');
  }
  if (typecheckFiles.length > 0) {
    if (!hasLocalPackages(root, ['tsc-files'])) missing.push('tsc-files');
    if (!hasLocalPackages(root, ['typescript'])) missing.push('typescript');
  }
  return [...new Set(missing)];
}

function toolingMissingMessage(packages) {
  return formatDeny({
    tag: 'harness-check',
    why: `Local check tooling is missing: ${packages.join(', ')}.`,
    next: [
      'Run `pnpm install --frozen-lockfile` from the project root.',
      'Continue after installation so the pending files are checked locally.',
    ],
    doNot: [
      'Run `npx` or `pnpm dlx` as a check fallback.',
      'Treat the pending files as checked before the local tools run.',
    ],
  });
}

/** @returns {{ ok: boolean, kind?: string, message?: string }} */
export function runFormat(root, relPaths) {
  if (process.env.CURSOR_CHECK_DRY_RUN === '1') {
    return { ok: true };
  }
  if (process.env.CURSOR_CHECK_DRY_RUN === 'fail') {
    return { ok: false, kind: 'failed', message: '[check] dry-run: format failed' };
  }

  const files = filterByExt(existingRelPaths(root, relPaths), FORMAT_LINT_EXT);
  if (files.length === 0) return { ok: true };

  if (!hasLocalPackages(root, ['oxfmt'])) {
    return {
      ok: false,
      kind: 'tooling-missing',
      message: toolingMissingMessage(['oxfmt']),
    };
  }

  const formatFailure = runCheckCommand(root, {
    label: 'format',
    localArgs: ['format'],
    files,
  });
  if (formatFailure) {
    return { ok: false, kind: 'failed', message: formatFailure };
  }
  return { ok: true };
}

/** @returns {{ ok: boolean, kind?: string, message?: string }} */
export function runFormatLint(root, relPaths) {
  if (process.env.CURSOR_CHECK_DRY_RUN === '1') {
    return { ok: true };
  }
  if (process.env.CURSOR_CHECK_DRY_RUN === 'fail') {
    return { ok: false, kind: 'failed', message: '[check] dry-run: lint failed' };
  }

  const existing = existingRelPaths(root, relPaths);
  const formatLintFiles = filterByExt(existing, FORMAT_LINT_EXT);
  const typecheckFiles = filterByExt(existing, TYPECHECK_EXT);

  if (formatLintFiles.length === 0 && typecheckFiles.length === 0) return { ok: true };

  const missing = missingTooling(root, formatLintFiles, typecheckFiles);
  if (missing.length > 0) {
    return {
      ok: false,
      kind: 'tooling-missing',
      message: toolingMissingMessage(missing),
    };
  }

  const parts = [];

  if (formatLintFiles.length > 0) {
    const formatFailure = runCheckCommand(root, {
      label: 'format',
      localArgs: ['format'],
      files: formatLintFiles,
    });
    if (formatFailure) parts.push(formatFailure);

    const lintFailure = runCheckCommand(root, {
      label: 'lint',
      localArgs: ['lint'],
      files: formatLintFiles,
    });
    if (lintFailure) parts.push(lintFailure);
  }

  if (typecheckFiles.length > 0) {
    const typecheckFailure = runCheckCommand(root, {
      label: 'typecheck',
      localArgs: ['typecheck:staged'],
      files: typecheckFiles,
    });
    if (typecheckFailure) parts.push(typecheckFailure);
  }

  if (parts.length === 0) return { ok: true };
  return { ok: false, kind: 'failed', message: parts.join('\n\n') };
}

/** postToolUse 向け: format 失敗を additional_context にする（gate にはしない） */
export function buildFormatContext(message, kind = 'failed') {
  const body = String(message ?? '').trim();
  if (!body) return '';
  if (kind === 'tooling-missing') return body;
  return [
    '[harness-check] format failed on the file just edited. Fix formatting, then continue.',
    '',
    body,
  ].join('\n');
}

export function buildCheckFollowup(message, kind = 'failed') {
  const body = String(message ?? '').trim();
  if (!body) return '';
  if (kind === 'tooling-missing') return body;
  return [
    '[harness-check] format/lint/typecheck failed on files edited this turn. Fix the issues below, then continue.',
    '',
    body,
  ].join('\n');
}

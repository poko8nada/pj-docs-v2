/**
 * 編集後チェック — format/lint（広い）と typecheck（ts/tsx のみ）。
 */
import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';
import { isExcludedFromReviewTrack } from './_review.mjs';

const FORMAT_LINT_EXT = /\.(ts|tsx|js|jsx|mjs|cjs)$/i;
const TYPECHECK_EXT = /\.(ts|tsx)$/i;

/** format / lint / typecheck に必要なルート依存パッケージ */
const CHECK_TOOL_PACKAGES = ['oxfmt', 'oxlint', 'typescript'];

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

/** oxfmt / oxlint / typescript が node_modules にあるか。 */
export function isCheckToolingReady(root) {
  return CHECK_TOOL_PACKAGES.every((name) => existsSync(join(root, 'node_modules', name)));
}

function existingRelPaths(root, relPaths) {
  return relPaths.filter((rel) => rel && existsSync(join(root, rel)));
}

function filterByExt(relPaths, extRe) {
  return relPaths.filter((rel) => extRe.test(rel));
}

/** @returns {{ ok: boolean, message?: string }} */
export function runFormatLint(root, relPaths) {
  if (process.env.CURSOR_CHECK_DRY_RUN === '1') {
    return { ok: true };
  }
  if (process.env.CURSOR_CHECK_DRY_RUN === 'fail') {
    return { ok: false, message: '[check] dry-run: lint failed' };
  }

  const existing = existingRelPaths(root, relPaths);
  const formatLintFiles = filterByExt(existing, FORMAT_LINT_EXT);
  const typecheckFiles = filterByExt(existing, TYPECHECK_EXT);

  if (formatLintFiles.length === 0 && typecheckFiles.length === 0) return { ok: true };

  // 未 install は失敗にせずスキップ（フォローアップループを起こさない）
  if (!isCheckToolingReady(root)) {
    process.stderr.write('[check] deps missing — skipped format/lint/typecheck\n');
    return { ok: true };
  }

  const parts = [];

  if (formatLintFiles.length > 0) {
    const format = spawnSync('pnpm', ['format', ...formatLintFiles], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    if (format.status !== 0) {
      parts.push(
        ['format failed:', format.stdout, format.stderr].filter(Boolean).join('\n').trim(),
      );
    }

    const lint = spawnSync('pnpm', ['lint', ...formatLintFiles], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    if (lint.status !== 0) {
      parts.push(['lint failed:', lint.stdout, lint.stderr].filter(Boolean).join('\n').trim());
    }
  }

  if (typecheckFiles.length > 0) {
    const typecheck = spawnSync('pnpm', ['typecheck:staged', ...typecheckFiles], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    if (typecheck.status !== 0) {
      parts.push(
        ['typecheck failed:', typecheck.stdout, typecheck.stderr].filter(Boolean).join('\n').trim(),
      );
    }
  }

  if (parts.length === 0) return { ok: true };
  return { ok: false, message: parts.join('\n\n') };
}

export function buildCheckFollowup(message) {
  const body = String(message ?? '').trim();
  if (!body) return '';
  return [
    '[harness-check] format/lint/typecheck failed on files edited this turn. Fix the issues below, then continue.',
    '',
    body,
  ].join('\n');
}

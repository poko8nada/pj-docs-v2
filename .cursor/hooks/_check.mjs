/**
 * 編集後チェック — 対象パスと pnpm format/lint 実行。
 */
import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';
import { isReviewablePath } from './_review.mjs';

const CHECKABLE_EXT = /\.(ts|tsx|js|jsx)$/i;

/** lefthook pre-commit と同じ拡張子（harness 除外は isReviewablePath） */
export function isCheckablePath(root, filePath) {
  if (!isReviewablePath(root, filePath)) return false;
  const abs = resolve(isAbsolute(filePath) ? filePath : resolve(root, String(filePath)));
  const rel = relative(root, abs);
  const posix = rel.split(sep).join('/');
  return CHECKABLE_EXT.test(posix);
}

function existingRelPaths(root, relPaths) {
  return relPaths.filter((rel) => rel && existsSync(join(root, rel)));
}

/** @returns {{ ok: boolean, message?: string }} */
export function runFormatLint(root, relPaths) {
  if (process.env.CURSOR_CHECK_DRY_RUN === '1') {
    return { ok: true };
  }
  if (process.env.CURSOR_CHECK_DRY_RUN === 'fail') {
    return { ok: false, message: '[check] dry-run: lint failed' };
  }

  const files = existingRelPaths(root, relPaths);
  if (files.length === 0) return { ok: true };

  const parts = [];
  const format = spawnSync('pnpm', ['format', ...files], {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (format.status !== 0) {
    parts.push(
      ['format failed:', format.stdout, format.stderr].filter(Boolean).join('\n').trim(),
    );
  }

  const lint = spawnSync('pnpm', ['lint', ...files], {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (lint.status !== 0) {
    parts.push(['lint failed:', lint.stdout, lint.stderr].filter(Boolean).join('\n').trim());
  }

  const typecheck = spawnSync('pnpm', ['typecheck:staged', ...files], {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (typecheck.status !== 0) {
    parts.push(
      ['typecheck failed:', typecheck.stdout, typecheck.stderr].filter(Boolean).join('\n').trim(),
    );
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

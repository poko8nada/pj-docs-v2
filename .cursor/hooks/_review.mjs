/**
 * Pre-commit reviewer gate — path rules, Task 識別、review.files の Task 注入。
 */
import { isAbsolute, relative, resolve, sep } from 'node:path';
import { isBootstrapMarkerPath } from './_bootstrap.mjs';
import { isUnderStateDir } from './_state.mjs';

const REVIEWABLE_EXT = /\.(ts|tsx|js|jsx|mjs|cjs|css|md|json|ya?ml)$/i;

export const DENY_REVIEW =
  '[gate-review] review.status is pending. Do not run `git add && git commit` together. ' +
  'Run (1) `git add <paths>` alone (2) `/pre-commit-reviewer` (3) `git commit` alone.';

export const REVIEW_INJECT_MARKER = '[harness-review]';

/** pre-commit-reviewer 相当の Task / subagent か */
export function isPreCommitReviewerContext(payload) {
  const input = payload.tool_input ?? {};
  const type = String(payload.subagent_type ?? input.subagent_type ?? input.subagentType ?? '');
  const task = String(
    payload.task ??
      payload.description ??
      input.description ??
      input.prompt ??
      input.task ??
      '',
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

/** 編集追跡対象（harness / product 一律。git diff は使わない） */
export function isReviewablePath(root, filePath) {
  if (isExcludedFromReviewTrack(root, filePath)) return false;
  const posix = relPosix(root, filePath);
  if (!posix) return false;
  return REVIEWABLE_EXT.test(posix);
}

/** check.pending 用 — product ソースのみ（harness 除外は従来どおり） */
export function isProductSourcePath(root, filePath) {
  if (!filePath || isExcludedFromReviewTrack(root, filePath)) return false;
  const posix = relPosix(root, filePath);
  if (!posix) return false;
  if (posix.startsWith('.cursor/hooks/')) return false;
  if (posix.startsWith('.cursor/skills/')) return false;
  if (posix.startsWith('.cursor/agents/')) return false;
  if (posix === 'lefthook.yaml') return false;
  if (!posix.includes('/') && /\.md$/i.test(posix)) return false;
  return REVIEWABLE_EXT.test(posix);
}

/** @param {string[]} files */
export function buildReviewTaskInjection(files) {
  if (!Array.isArray(files) || files.length === 0) return null;
  return [
    `${REVIEW_INJECT_MARKER} Review these paths (from review.files; do not use git diff):`,
    ...files.map((f) => `- ${f}`),
    '',
  ].join('\n');
}

/** preToolUse Task 用: review.files を prompt / description / task に前置 */
export function injectReviewFilesIntoTaskInput(toolInput, files) {
  const block = buildReviewTaskInjection(files);
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

/** `git add` を含むか（segment 単位） */
export function commandIncludesGitAdd(command) {
  return shellSegments(command).some((seg) => /\bgit\b/.test(seg) && /\badd\b/.test(seg));
}

/**
 * `git add` の明示パスを抽出（`.` / glob / フラグは無視 — git diff は使わない）。
 * @returns {string[]}
 */
export function pathsFromGitAddCommand(command) {
  const out = [];
  for (const seg of shellSegments(command)) {
    if (!/\bgit\b/.test(seg) || !/\badd\b/.test(seg)) continue;
    const tokens = seg.split(/\s+/).filter(Boolean);
    let i = tokens.findIndex((t) => t === 'add');
    if (i < 0) continue;
    i += 1;
    while (i < tokens.length) {
      const t = tokens[i];
      if (t === '--') {
        i += 1;
        while (i < tokens.length) {
          const p = tokens[i];
          if (p && p !== '.' && !p.includes('*') && !p.includes('?')) out.push(p);
          i += 1;
        }
        break;
      }
      if (t.startsWith('-')) {
        // -u / --all / -A / -p などはパスを持たない（値付きオプションは稀なのでスキップ）
        if (t === '--' || t === '-A' || t === '--all' || t === '-u' || t === '--update') {
          i += 1;
          continue;
        }
        i += 1;
        continue;
      }
      if (t === '.' || t.includes('*') || t.includes('?')) {
        i += 1;
        continue;
      }
      out.push(t);
      i += 1;
    }
  }
  return [...new Set(out)];
}

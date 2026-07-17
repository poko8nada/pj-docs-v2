/**
 * Pre-commit reviewer gate — path rules, Task 識別、review.files の Task 注入。
 */
import { isAbsolute, relative, resolve, sep } from 'node:path';
import { isBootstrapMarkerPath } from './_bootstrap.mjs';
import { isUnderStateDir } from './_state.mjs';

/** コード＋CSSのみ（md/json/yaml は Issue 下書き等で gate を汚さない） */
const REVIEWABLE_EXT = /\.(ts|tsx|js|jsx|mjs|cjs|css)$/i;

/** @param {string[]} files */
export function denyReviewMessage(files) {
  const list = Array.isArray(files) && files.length > 0 ? files.join(', ') : '(none)';
  return (
    `[gate-review] review.files is non-empty (unreviewed): ${list}. ` +
    'Run `/pre-commit-reviewer` to clear them, then `git commit`. ' +
    '`git add` order does not matter.'
  );
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

/** 編集追跡対象（harness / product 一律。git diff は使わない） */
export function isReviewablePath(root, filePath) {
  if (isExcludedFromReviewTrack(root, filePath)) return false;
  const posix = relPosix(root, filePath);
  if (!posix) return false;
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

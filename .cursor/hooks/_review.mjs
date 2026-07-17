/**
 * Pre-commit reviewer gate — path rules, Task 識別、review.files の Task 注入。
 */
import { isAbsolute, relative, resolve, sep } from 'node:path';
import { isBootstrapMarkerPath } from './_bootstrap.mjs';
import { isUnderStateDir } from './_state.mjs';

const REVIEWABLE_EXT = /\.(ts|tsx|js|jsx|mjs|cjs|css|md|json|ya?ml)$/i;

export const DENY_REVIEW =
  '[gate-review] review.status is pending. Launch /pre-commit-reviewer on the accumulated files, then commit.';

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

/** preToolUse Task 用: review.files を prompt / description に前置 */
export function injectReviewFilesIntoTaskInput(toolInput, files) {
  const block = buildReviewTaskInjection(files);
  if (!block) return null;
  const input = toolInput && typeof toolInput === 'object' ? { ...toolInput } : {};
  const original = String(input.prompt ?? input.description ?? input.task ?? '');
  const merged = `${block}${original}`;
  if (input.prompt !== undefined || input.description === undefined) input.prompt = merged;
  if (input.description !== undefined) input.description = merged;
  if (input.prompt === undefined && input.description === undefined) input.prompt = merged;
  return input;
}

/** `git commit` を含むか（segment 単位） */
export function commandIncludesGitCommit(command) {
  const cleaned = String(command ?? '')
    .replace(/<<-?\s*["']?(\w+)["']?[\s\S]*?\n\s*\1/g, ' ')
    .replace(/(["'])(?:\\.|(?!\1)[^\\])*\1/g, ' ');
  const segments = cleaned
    .split(/&&|\|\||;|\n|\|/)
    .map((s) => s.trim())
    .filter(Boolean);
  return segments.some((seg) => /\bgit\b/.test(seg) && /\bcommit\b/.test(seg));
}

/**
 * Pre-commit reviewer gate — path rules and Task 識別。
 */
import { isAbsolute, relative, resolve, sep } from 'node:path';
import { isUnderStateDir } from './_state.mjs';

const REVIEWABLE_EXT = /\.(ts|tsx|js|jsx|mjs|cjs|css)$/i;

export const DENY_REVIEW =
  '[gate-review] Review required before commit. Launch /pre-commit-reviewer once on changed files, then commit.';

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

/** Product / test sources that require reviewer before commit. */
export function isReviewablePath(root, filePath) {
  if (!filePath) return false;
  const abs = resolve(isAbsolute(filePath) ? filePath : resolve(root, String(filePath)));
  if (isUnderStateDir(root, abs)) return false;

  const rel = relative(root, abs);
  if (!rel || rel.startsWith('..') || rel.includes(`..${sep}`)) return false;

  const posix = rel.split(sep).join('/');
  if (posix.startsWith('.cursor/hooks/')) return false;
  if (posix.startsWith('.cursor/skills/')) return false;
  if (posix.startsWith('.cursor/agents/')) return false;
  if (posix === 'lefthook.yaml') return false;
  if (!posix.includes('/') && /\.md$/i.test(posix)) return false;

  return REVIEWABLE_EXT.test(posix);
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

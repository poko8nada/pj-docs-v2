/**
 * implement/references 既読ゲート — 拡張子ごとに必要な reference を要求する。
 */
import { basename, isAbsolute, relative, resolve, sep } from 'node:path';

export const IMPLEMENT_REF_NAMES = new Set([
  'typescript.md',
  'css.md',
  'testing.md',
  'markdown.md',
]);

const REFS_DIR = '.cursor/skills/implement/references';

/** @param {string[]} refs */
export function normalizeReadRefs(refs) {
  if (!Array.isArray(refs)) return [];
  return [...new Set(refs.map((r) => String(r)).filter((r) => IMPLEMENT_REF_NAMES.has(r)))];
}

function relPosix(root, filePath) {
  if (!filePath) return null;
  const abs = resolve(isAbsolute(filePath) ? filePath : resolve(root, String(filePath)));
  const rel = relative(root, abs);
  if (!rel || rel.startsWith('..') || rel.includes(`..${sep}`)) return null;
  return rel.split(sep).join('/');
}

/** implement/references 配下の既知 md なら basename（例: typescript.md） */
export function implementRefBasename(root, filePath) {
  const posix = relPosix(root, filePath);
  if (!posix || !posix.startsWith(`${REFS_DIR}/`)) return null;
  const name = basename(posix);
  return IMPLEMENT_REF_NAMES.has(name) ? name : null;
}

/**
 * 編集 path に必要な reference basename 一覧。
 * テストは testing のみ。mjs/cjs は不要。
 * @returns {string[]}
 */
export function requiredRefsForPath(root, filePath) {
  const posix = relPosix(root, filePath);
  if (!posix) return [];
  if (/\.test\.(ts|tsx)$/i.test(posix)) return ['testing.md'];
  if (/\.css$/i.test(posix)) return ['css.md'];
  if (/\.mdc?$/i.test(posix)) return ['markdown.md'];
  if (/\.(mjs|cjs)$/i.test(posix)) return [];
  if (/\.(ts|tsx|js|jsx)$/i.test(posix)) return ['typescript.md'];
  return [];
}

/** @param {string[]} readRefs @param {string[]} required */
export function missingRefs(readRefs, required) {
  const have = new Set(normalizeReadRefs(readRefs));
  return required.filter((r) => !have.has(r));
}

/** @param {string[]} missing */
export function denyRefsMessage(missing) {
  const list = missing.map((m) => `\`${REFS_DIR}/${m}\``).join(', ');
  return (
    `[gate-refs] Missing implement reference Read(s): ${list}. ` +
    'Read the listed file(s) before editing this path.'
  );
}

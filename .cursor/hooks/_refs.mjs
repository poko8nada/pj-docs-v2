/**
 * skill references 既読ゲート — `skill/name.md` 形式で記録・判定する。
 * 有効な skill / ref は `.cursor/skills/` を動的に走査する。
 */
import { existsSync, readdirSync } from 'node:fs';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';

const SKILLS_ROOT = '.cursor/skills';

/** 旧 state 互換: implement の basename のみ */
const LEGACY_IMPLEMENT_REF_NAMES = new Set([
  'typescript.md',
  'css.md',
  'testing.md',
  'markdown.md',
]);

/** @type {RegExp} `skill/file.md` */
const REF_ID_RE = /^[a-zA-Z0-9._-]+\/[a-zA-Z0-9._-]+\.md$/;

function relPosix(root, filePath) {
  if (!filePath) return null;
  const abs = resolve(isAbsolute(filePath) ? filePath : resolve(root, String(filePath)));
  const rel = relative(root, abs);
  if (!rel || rel.startsWith('..') || rel.includes(`..${sep}`)) return null;
  return rel.split(sep).join('/');
}

/** `.cursor/skills/<name>/SKILL.md` があるディレクトリ名 */
export function discoverSkillNames(root) {
  const dir = join(root, SKILLS_ROOT);
  if (!existsSync(dir)) return new Set();
  /** @type {Set<string>} */
  const out = new Set();
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    if (!ent.isDirectory()) continue;
    if (existsSync(join(dir, ent.name, 'SKILL.md'))) out.add(ent.name);
  }
  return out;
}

/** `.cursor/skills/<skill>/references/*.md` → `skill/name.md` */
export function discoverRefIds(root) {
  const dir = join(root, SKILLS_ROOT);
  if (!existsSync(dir)) return new Set();
  /** @type {Set<string>} */
  const out = new Set();
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    if (!ent.isDirectory()) continue;
    const refsDir = join(dir, ent.name, 'references');
    if (!existsSync(refsDir)) continue;
    for (const f of readdirSync(refsDir, { withFileTypes: true })) {
      if (!f.isFile() || !/\.md$/i.test(f.name)) continue;
      out.add(`${ent.name}/${f.name}`);
    }
  }
  return out;
}

/**
 * @param {string} raw
 * @returns {string | null} `skill/name.md`
 */
export function coerceRefId(raw) {
  let id = String(raw ?? '').trim();
  if (!id) return null;
  if (LEGACY_IMPLEMENT_REF_NAMES.has(id)) id = `implement/${id}`;
  if (!REF_ID_RE.test(id)) return null;
  return id;
}

/**
 * @param {string[]} refs
 * @param {string | null} [root] あればディスク上の既知 ref に限定
 */
export function normalizeReadRefs(refs, root = null) {
  if (!Array.isArray(refs)) return [];
  const valid = root != null ? discoverRefIds(root) : null;
  /** @type {string[]} */
  const out = [];
  for (const raw of refs) {
    const id = coerceRefId(raw);
    if (!id) continue;
    if (valid && !valid.has(id)) continue;
    out.push(id);
  }
  return [...new Set(out)].toSorted();
}

/**
 * `.cursor/skills/<skill>/references/<file>.md` → `skill/file.md`
 * @returns {string | null}
 */
export function skillRefIdFromPath(root, filePath) {
  const posix = relPosix(root, filePath);
  if (!posix) return null;
  const m = posix.match(/^\.cursor\/skills\/([^/]+)\/references\/([^/]+\.md)$/i);
  if (!m) return null;
  const id = `${m[1]}/${m[2]}`;
  const valid = discoverRefIds(root);
  return valid.has(id) ? id : null;
}

/**
 * implement/references のみ（編集ゲート用）。互換 alias。
 * @returns {string | null} `implement/….md`
 */
export function implementRefBasename(root, filePath) {
  const id = skillRefIdFromPath(root, filePath);
  if (!id || !id.startsWith('implement/')) return null;
  return id;
}

/**
 * 編集 path に必要な reference id 一覧（`implement/….md`）。
 * テストは testing のみ。mjs/cjs は不要。
 * @returns {string[]}
 */
export function requiredRefsForPath(root, filePath) {
  const posix = relPosix(root, filePath);
  if (!posix) return [];
  if (/\.test\.(ts|tsx)$/i.test(posix)) return ['implement/testing.md'];
  if (/\.css$/i.test(posix)) return ['implement/css.md'];
  if (/\.mdc?$/i.test(posix)) return ['implement/markdown.md'];
  if (/\.(mjs|cjs)$/i.test(posix)) return [];
  if (/\.(ts|tsx|js|jsx)$/i.test(posix)) return ['implement/typescript.md'];
  return [];
}

/** @param {string[]} readRefs @param {string[]} required */
export function missingRefs(readRefs, required) {
  const have = new Set(normalizeReadRefs(readRefs));
  return required.filter((r) => !have.has(r));
}

/** `implement/typescript.md` → `.cursor/skills/implement/references/typescript.md` */
export function refIdToRelPath(refId) {
  const id = coerceRefId(refId);
  if (!id) return null;
  const slash = id.indexOf('/');
  const skill = id.slice(0, slash);
  const name = id.slice(slash + 1);
  return `${SKILLS_ROOT}/${skill}/references/${name}`;
}

/** @param {string[]} missing */
export function denyRefsMessage(missing) {
  const list = missing
    .map((m) => {
      const rel = refIdToRelPath(m);
      return rel ? `\`${rel}\`` : `\`${m}\``;
    })
    .join(', ');
  return (
    `[gate-refs] Missing implement reference Read(s): ${list}. ` +
    'Read the listed file(s) before editing this path.'
  );
}

/** @deprecated use discoverRefIds; kept for older imports */
export const IMPLEMENT_REF_NAMES = LEGACY_IMPLEMENT_REF_NAMES;

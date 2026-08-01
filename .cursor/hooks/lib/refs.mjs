/**
 * skill references 既読ゲート — `skill/name.md` 形式で記録・判定する。
 * 有効な skill / ref は `.cursor/skills/` を動的に走査する。
 */
import { existsSync, readdirSync } from 'node:fs';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';
import { formatDeny } from './deny-format.mjs';

const SKILLS_ROOT = '.cursor/skills';
const RULES_SKILL = 'rules';

/** @type {RegExp} `skill/file.md` */
const REF_ID_RE = /^[a-zA-Z0-9._-]+\/[a-zA-Z0-9._-]+\.md$/;

/** reference 命名変更後も既存 conversation state の read.refs を新 ID へ寄せる。 */
const REF_ID_ALIASES = new Map([
  ['rules/shared.md', 'rules/conventions.md'],
  ['rules/html.md', 'rules/markup.md'],
  ['rules/state.md', 'rules/ui-state.md'],
]);

/** 弱ゲート: 「rules 配下を1つ以上」の sentinel（required 配列内） */
export const ANY_RULES_REF = `${RULES_SKILL}/*`;

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
  const id = String(raw ?? '').trim();
  if (!id) return null;
  if (!REF_ID_RE.test(id)) return null;
  return REF_ID_ALIASES.get(id) ?? id;
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
 * 編集 path が rules-ref ゲート対象か（mjs/cjs は対象外）。
 */
export function pathNeedsRulesRef(root, filePath) {
  const posix = relPosix(root, filePath);
  if (!posix) return false;
  if (/\.(mjs|cjs)$/i.test(posix)) return false;
  if (/\.test\.(ts|tsx)$/i.test(posix)) return true;
  if (/\.css$/i.test(posix)) return true;
  if (/\.mdc?$/i.test(posix)) return true;
  if (/\.(ts|tsx|js|jsx)$/i.test(posix)) return true;
  return false;
}

/**
 * 編集 path に必要な reference 要件。
 * 弱ゲート: 対象 path なら `rules/*`（どれか1つ）のみ。
 * @returns {string[]}
 */
export function requiredRefsForPath(root, filePath) {
  if (!pathNeedsRulesRef(root, filePath)) return [];
  return [ANY_RULES_REF];
}

/** read.refs に rules/ 配下が1つ以上あるか */
export function hasAnyRulesRef(readRefs) {
  return normalizeReadRefs(readRefs).some((r) => r.startsWith(`${RULES_SKILL}/`));
}

/**
 * @param {string[]} readRefs
 * @param {string[]} required
 * @returns {string[]} missing（sentinel または具体 id）
 */
export function missingRefs(readRefs, required) {
  if (!required.length) return [];
  if (required.includes(ANY_RULES_REF)) {
    return hasAnyRulesRef(readRefs) ? [] : [ANY_RULES_REF];
  }
  const have = new Set(normalizeReadRefs(readRefs));
  return required.filter((r) => !have.has(r));
}

/** `rules/conventions.md` → `.cursor/skills/rules/references/conventions.md` */
export function refIdToRelPath(refId) {
  if (refId === ANY_RULES_REF) {
    return `${SKILLS_ROOT}/${RULES_SKILL}/references/`;
  }
  const id = coerceRefId(refId);
  if (!id) return null;
  const slash = id.indexOf('/');
  const skill = id.slice(0, slash);
  const name = id.slice(slash + 1);
  return `${SKILLS_ROOT}/${skill}/references/${name}`;
}

/** @param {string[]} missing */
export function denyRefsMessage(missing) {
  if (missing.includes(ANY_RULES_REF)) {
    return formatDeny({
      tag: 'gate-refs',
      why: 'Missing rules reference: at least one file under rules/references is required before editing this path.',
      next: [
        `Execute at least one file under \`${SKILLS_ROOT}/${RULES_SKILL}/references/\`.`,
        'Retry the edit only after that Read is recorded.',
      ],
    });
  }
  const list = missing
    .map((m) => {
      const rel = refIdToRelPath(m);
      return rel ? `\`${rel}\`` : `\`${m}\``;
    })
    .join(', ');
  return formatDeny({
    tag: 'gate-refs',
    why: `Missing rules reference(s): ${list}.`,
    next: [
      'Execute the listed reference file(s).',
      'Retry the edit only after those Reads are recorded.',
    ],
  });
}

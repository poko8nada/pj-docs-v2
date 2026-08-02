/**
 * Pre-commit reviewer gate — path rules, Task 識別、Git snapshot の Task 注入、
 * commit 前の子 transcript PASS binding。
 */
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { isBootstrapMarkerPath } from './bootstrap.mjs';
import { formatDeny } from './deny-format.mjs';
import { idFromTranscriptPath, isUnderStateDir } from './state.mjs';

/** コード＋CSS＋HTMLのみ（md/json/yaml は Issue 下書き等で gate を汚さない） */
const REVIEWABLE_EXT = /\.(ts|tsx|js|jsx|mjs|cjs|css|html)$/i;

/** path ごとの diff／新規本文のソフト上限 */
export const REVIEW_DIFF_MAX_PER_FILE = 8000;
/** 注入全体のソフト上限 */
export const REVIEW_DIFF_MAX_TOTAL = 48000;

/**
 * @param {{ kind: string, hash?: string | null, paths?: string[], message?: string | null }} snapshot
 * @param {{
 *   snapshotHash: string | null,
 *   snapshotAt: string | null,
 *   reviewerTranscriptId: string | null,
 *   binding: 'unbound' | 'bound' | null
 * }} review
 */
export function denyReviewMessage(snapshot, review) {
  const list =
    Array.isArray(snapshot?.paths) && snapshot.paths.length > 0
      ? snapshot.paths.join(', ')
      : '(none)';
  let reason;
  if (snapshot?.kind === 'error') {
    reason = `Unable to calculate the current Git snapshot: ${snapshot.message ?? 'unknown error'}.`;
  } else if (!review?.snapshotHash) {
    reason = `Current Git snapshot has reviewable changes: ${list}. No reviewer snapshot has been recorded yet.`;
  } else if (review.snapshotHash !== snapshot?.hash) {
    reason = `Current Git snapshot differs from the reviewer snapshot: ${list}.`;
  } else if (review?.binding === 'bound') {
    reason = 'The current Git snapshot already has a bound reviewer PASS.';
  } else {
    reason = 'No verified reviewer PASS is bound to the current Git snapshot yet.';
  }
  return formatDeny({
    tag: 'gate-review',
    why: reason,
    next: [
      'Run `/pre-commit-reviewer` (need `REVIEW: PASS` in the child transcript).',
      'Then stop or `git commit` (`git add` order does not matter).',
    ],
    doNot: [
      'Retry `git commit` unchanged while the current Git snapshot is unreviewed.',
      'Skip the reviewer or invent a commit flag to bypass hooks.',
    ],
  });
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

/** Git snapshot から除外（state / bootstrap / smoke 一時） */
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

/** 編集追跡対象（harness / product 一律。path 特定に git diff は使わない） */
export function isReviewablePath(root, filePath) {
  if (isExcludedFromReviewTrack(root, filePath)) return false;
  const posix = relPosix(root, filePath);
  if (!posix) return false;
  return REVIEWABLE_EXT.test(posix);
}

function gitRun(root, args) {
  return spawnSync('git', args, {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 2 * 1024 * 1024,
  });
}

function gitPathList(root, args, label) {
  const run = gitRun(root, args);
  if (run.error) {
    return { error: `${label} failed: ${run.error.message}` };
  }
  if (Number(run.status ?? 0) !== 0) {
    const err = String(run.stderr ?? '').trim() || `exit ${run.status}`;
    return { error: `${label} failed: ${err}` };
  }
  return {
    paths: String(run.stdout ?? '')
      .split('\0')
      .filter((path) => path.length > 0),
  };
}

function readReviewFile(root, relPath) {
  const abs = resolve(root, relPath);
  try {
    return { kind: 'new', body: readFileSync(abs, 'utf8') };
  } catch (e) {
    return { kind: 'error', body: `read failed: ${e instanceof Error ? e.message : String(e)}` };
  }
}

/**
 * @returns {{ kind: 'diff' | 'new' | 'empty' | 'error', body: string }}
 */
export function collectReviewDiff(root, relPath) {
  const posix = String(relPath).split(sep).join('/');
  const abs = resolve(root, posix);

  // git diff: exit 0 = 差分なし, 1 = 差分あり, それ以外 = エラー
  const diffRun = gitRun(root, ['diff', 'HEAD', '--', posix]);
  if (diffRun.error) {
    return { kind: 'error', body: `git diff failed: ${diffRun.error.message}` };
  }
  const diffCode = Number(diffRun.status ?? 0);
  if (diffCode !== 0 && diffCode !== 1) {
    const err = String(diffRun.stderr ?? '').trim() || `exit ${diffCode}`;
    return { kind: 'error', body: `git diff failed: ${err}` };
  }
  const diff = String(diffRun.stdout ?? '').trimEnd();
  if (diff) return { kind: 'diff', body: diff };

  const lsRun = gitRun(root, ['ls-files', '--', posix]);
  if (lsRun.error) {
    return { kind: 'error', body: `git ls-files failed: ${lsRun.error.message}` };
  }
  if (Number(lsRun.status ?? 0) !== 0) {
    const err = String(lsRun.stderr ?? '').trim() || `exit ${lsRun.status}`;
    return { kind: 'error', body: `git ls-files failed: ${err}` };
  }
  const tracked = String(lsRun.stdout ?? '').trim();
  if (!tracked && existsSync(abs)) {
    return readReviewFile(root, posix);
  }
  return { kind: 'empty', body: '' };
}

/**
 * Git の現在差分をレビュー対象の拡張子で絞り、内容 fingerprint を作る。
 * tracked の staged/unstaged/deleted と untracked を同じ snapshot に含める。
 * @param {{ includeEntries?: boolean }} options
 */
export function collectReviewSnapshot(root, options = {}) {
  const tracked = gitPathList(
    root,
    ['diff', '--name-only', '--no-renames', '-z', 'HEAD', '--'],
    'git diff path list',
  );
  if (tracked.error) {
    return { kind: 'error', message: tracked.error, paths: [], entries: [], hash: null };
  }

  const untracked = gitPathList(
    root,
    ['ls-files', '--others', '--exclude-standard', '-z'],
    'git untracked path list',
  );
  if (untracked.error) {
    return { kind: 'error', message: untracked.error, paths: [], entries: [], hash: null };
  }

  const trackedPaths = tracked.paths.filter((path) => isReviewablePath(root, path)).toSorted();
  const untrackedPaths = untracked.paths.filter((path) => isReviewablePath(root, path)).toSorted();
  const paths = [...new Set([...trackedPaths, ...untrackedPaths])].toSorted();
  if (paths.length === 0) {
    return { kind: 'empty', message: null, paths: [], entries: [], hash: null };
  }

  const trackedDiffRun = gitRun(
    root,
    trackedPaths.length > 0
      ? ['diff', '--no-renames', '--binary', 'HEAD', '--', ...trackedPaths]
      : ['diff', '--no-renames', '--binary', 'HEAD', '--'],
  );
  const trackedDiffCode = Number(trackedDiffRun.status ?? 0);
  if (trackedDiffRun.error || (trackedDiffCode !== 0 && trackedDiffCode !== 1)) {
    const error =
      trackedDiffRun.error?.message ||
      String(trackedDiffRun.stderr ?? '').trim() ||
      `exit ${trackedDiffRun.status}`;
    return {
      kind: 'error',
      message: `git diff content failed: ${error}`,
      paths,
      entries: [],
      hash: null,
    };
  }

  const untrackedBodies = [];
  for (const path of untrackedPaths) {
    const result = readReviewFile(root, path);
    if (result.kind === 'error') {
      return {
        kind: 'error',
        message: `${path}: ${result.body}`,
        paths,
        entries: [],
        hash: null,
      };
    }
    untrackedBodies.push({ path, body: result.body });
  }

  const serialized = [
    `tracked\0${trackedPaths.join('\0')}\0${String(trackedDiffRun.stdout ?? '')}\0`,
    ...untrackedBodies.map(({ path, body }) => `untracked\0${path}\0${body}\0`),
  ].join('');
  const hash = `sha256:${createHash('sha256').update(serialized).digest('hex')}`;
  const entries = options.includeEntries
    ? paths.map((path) => ({ path, ...collectReviewDiff(root, path) }))
    : [];
  return { kind: 'snapshot', message: null, paths, entries, hash };
}

function truncateBlock(text, max, label) {
  if (text.length <= max) return text;
  const kept = Math.max(0, max - 80);
  return (
    text.slice(0, kept) +
    `\n… [truncated ${text.length - kept} chars from ${label}; Read the file only if critical]\n`
  );
}

/**
 * @param {{ path: string, kind: string, body: string }[]} entries
 * @param {string | null} root
 */
function buildReviewTaskInjectionFromEntries(entries, root = null) {
  if (!Array.isArray(entries) || entries.length === 0) return null;
  const lines = [
    `${REVIEW_INJECT_MARKER} Review the following current Git snapshot.`,
    ...(root ? [`Full Repository Path: ${resolve(root)}`, 'Diff: current Git snapshot'] : []),
    'Focus on the injected diff / new-file content. Do not run git. Do not Read whole files unless the injection is truncated and critical context is missing.',
    '',
  ];

  let total = lines.join('\n').length;
  for (const { path: f, kind, body } of entries) {
    let section;
    if (kind === 'diff') {
      const text = truncateBlock(body, REVIEW_DIFF_MAX_PER_FILE, f);
      section = `### ${f}\n\`\`\`diff\n${text}\n\`\`\`\n`;
    } else if (kind === 'new') {
      const text = truncateBlock(body, REVIEW_DIFF_MAX_PER_FILE, f);
      section = `### ${f}\n(new or untracked — full content)\n\`\`\`\n${text}\n\`\`\`\n`;
    } else if (kind === 'error') {
      section = `### ${f}\n(git error — do not assume unchanged)\n\`\`\`\n${body}\n\`\`\`\n`;
    } else {
      section = `### ${f}\n(no diff vs HEAD — unchanged or missing; skip unless you must verify deletion)\n`;
    }

    if (total + section.length > REVIEW_DIFF_MAX_TOTAL) {
      lines.push(
        `… [omitted remaining paths; total injection cap ${REVIEW_DIFF_MAX_TOTAL} chars]`,
        '',
      );
      break;
    }
    lines.push(section);
    total += section.length;
  }

  return lines.join('\n');
}

export function buildReviewTaskInjection(root, files) {
  if (!Array.isArray(files) || files.length === 0) return null;
  const entries = files.map((path) => ({ path, ...collectReviewDiff(root, path) }));
  return buildReviewTaskInjectionFromEntries(entries, root);
}

export function buildReviewSnapshotTaskInjection(root, snapshot) {
  if (!snapshot || snapshot.kind !== 'snapshot') return null;
  return buildReviewTaskInjectionFromEntries(snapshot.entries, root);
}

function mergeReviewTaskInput(toolInput, block) {
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

/** preToolUse Task 用: current Git snapshot を prompt / description / task に前置 */
export function injectReviewSnapshotIntoTaskInput(toolInput, root, snapshot) {
  return mergeReviewTaskInput(toolInput, buildReviewSnapshotTaskInjection(root, snapshot));
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

/**
 * agent-transcripts の候補ディレクトリを返す。
 * workspace からの導出を優先し、runtime transcript path は位置解決の
 * fallback としてだけ使う。runtime path は親の identity には使わない。
 * テストは CURSOR_GATE_TRANSCRIPTS_DIR で上書きする。
 */
function transcriptRootFromPath(transcriptPath) {
  if (!transcriptPath || typeof transcriptPath !== 'string') return null;
  const abs = resolve(transcriptPath);
  const id = idFromTranscriptPath(abs);
  if (!id || basename(dirname(abs)) !== id) return null;
  return dirname(dirname(abs));
}

function cursorProjectSlug(root) {
  return String(root)
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function agentTranscriptsDirs(root = null) {
  const override = process.env.CURSOR_GATE_TRANSCRIPTS_DIR;
  if (override && String(override).trim()) return [resolve(String(override).trim())];

  const dirs = [];
  const home = process.env.HOME || '';
  if (root && home) {
    dirs.push(join(home, '.cursor', 'projects', cursorProjectSlug(root), 'agent-transcripts'));
  }

  const runtimeDir = transcriptRootFromPath(process.env.CURSOR_TRANSCRIPT_PATH);
  if (runtimeDir) dirs.push(runtimeDir);

  return [...new Set(dirs)];
}

export function agentTranscriptsDir(root = null) {
  return agentTranscriptsDirs(root)[0] ?? null;
}

function transcriptPathFromId(transcriptId, root = null) {
  const id = idFromTranscriptPath(transcriptId);
  if (!id) return null;
  for (const dir of agentTranscriptsDirs(root)) {
    const path = join(dir, id, `${id}.jsonl`);
    if (existsSync(path)) return path;
  }
  return null;
}

/** 最後の assistant message にある `REVIEW: PASS|GAPS`（大文字化）。 */
export function lastReviewVerdict(text) {
  const assistantTexts = jsonlRecords(text)
    .filter((record) => record?.role === 'assistant')
    .map((record) => textFromContent(record.message?.content))
    .filter(Boolean);
  const source = assistantTexts.at(-1) ?? '';
  const re = /REVIEW:\s*(PASS|GAPS)\b/gi;
  let last = null;
  let m;
  while ((m = re.exec(source)) !== null) {
    last = m[1].toUpperCase();
  }
  return last;
}

/** JSONL を parse し、壊れた行を除外して返す。 */
function jsonlRecords(text) {
  const records = [];
  for (const line of String(text ?? '').split(/\r?\n/)) {
    if (!line.trim()) continue;
    try {
      records.push(JSON.parse(line));
    } catch {
      // 壊れた行は候補判定に使わず、残りの JSONL を調べる。
    }
  }
  return records;
}

function textFromContent(content) {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .filter((item) => item && typeof item === 'object' && item.type === 'text')
      .map((item) => String(item.text ?? ''))
      .join('\n');
  }
  if (content && typeof content === 'object' && typeof content.text === 'string') {
    return content.text;
  }
  return '';
}

/**
 * 最終 assistant message の直前にある最後の user prompt を返す。
 * fresh 起動と resume 継続のどちらでも、今回の review 依頼を比較対象にする。
 */
function lastUserPromptBeforeFinalAssistant(text) {
  const records = jsonlRecords(text);
  let finalAssistantIndex = -1;
  for (let index = records.length - 1; index >= 0; index -= 1) {
    if (records[index]?.role === 'assistant') {
      finalAssistantIndex = index;
      break;
    }
  }
  if (finalAssistantIndex < 0) return null;

  for (let index = finalAssistantIndex - 1; index >= 0; index -= 1) {
    if (records[index]?.role !== 'user') continue;
    const prompt = textFromContent(records[index].message?.content);
    if (prompt.trim()) return prompt;
  }
  return null;
}

function normalizePrompt(text) {
  const body = String(text ?? '');
  const match = body.match(/<user_query>\s*([\s\S]*?)\s*<\/user_query>/i);
  return (match ? match[1] : body).replace(/\s+/g, ' ').trim();
}

function lastSubagentPrompt(text) {
  const prompts = [];

  function visit(value) {
    if (!value || typeof value !== 'object') return;
    if (Array.isArray(value)) {
      for (const item of value) visit(item);
      return;
    }

    const type = String(value.type ?? '').toLowerCase();
    const name = String(value.name ?? '').toLowerCase();
    if (type === 'tool_use' && (name === 'subagent' || name === 'task')) {
      const input = value.input ?? value.tool_input ?? {};
      const prompt = input.prompt ?? input.description ?? input.task;
      if (typeof prompt === 'string' && prompt.trim()) prompts.push(prompt);
    }

    if (String(value.tool_name ?? '').toLowerCase() === 'task') {
      const input = value.tool_input ?? {};
      const prompt = input.prompt ?? input.description ?? input.task;
      if (typeof prompt === 'string' && prompt.trim()) prompts.push(prompt);
    }

    for (const child of Object.values(value)) visit(child);
  }

  for (const record of jsonlRecords(text)) visit(record);
  return prompts.at(-1) ?? null;
}

function readTranscript(path) {
  if (!path) return null;
  try {
    return readFileSync(path, 'utf8');
  } catch {
    return null;
  }
}

function parentTranscriptInfo(root, parentId) {
  const path = transcriptPathFromId(parentId, root);
  if (!path) return null;
  const prompt = normalizePrompt(lastSubagentPrompt(readTranscript(path)));
  if (!prompt) return null;
  return { path, prompt };
}

/**
 * snapshotAt 以降の PASS 候補と、親 transcript の最後の Subagent prompt を
 * whitespace-normalize して照合する。署名の推測や mtime 順の勝手な選択はせず、
 * 一意に一致した場合だけ path を返す。
 */
export function findReviewPassTranscript(root, parentId = null, snapshotAt = null) {
  const snapshotAtMs = Date.parse(String(snapshotAt ?? ''));
  if (!Number.isFinite(snapshotAtMs)) return null;

  const parent = parentTranscriptInfo(root, parentId);
  if (!parent) return null;

  const excludedIds = new Set(
    [parentId, idFromTranscriptPath(parent.path)].filter((value) => value),
  );
  const matches = [];

  for (const dir of agentTranscriptsDirs(root)) {
    if (!existsSync(dir)) continue;

    let names;
    try {
      names = readdirSync(dir);
    } catch {
      continue;
    }

    for (const name of names) {
      const jsonl = join(dir, name, `${name}.jsonl`);
      const candidateId = idFromTranscriptPath(jsonl);
      if (!candidateId || excludedIds.has(candidateId) || !existsSync(jsonl)) continue;
      if (isReviewPassUsed(jsonl)) continue;

      let st;
      try {
        st = statSync(jsonl);
      } catch {
        continue;
      }
      if (st.mtimeMs < snapshotAtMs) continue;

      const text = readTranscript(jsonl);
      if (lastReviewVerdict(text) !== 'PASS') continue;
      if (normalizePrompt(lastUserPromptBeforeFinalAssistant(text)) !== parent.prompt) continue;
      matches.push({ jsonl, mtimeMs: st.mtimeMs });
    }
  }

  return matches.length === 1 ? matches[0].jsonl : null;
}

/** jsonl 隣の使い済みフラグ path（`<id>.jsonl` → `<id>.harness-pass-used`） */
export function reviewPassUsedPath(jsonlPath) {
  const dir = dirname(jsonlPath);
  const id = basename(String(jsonlPath), '.jsonl');
  return join(dir, `${id}.harness-pass-used`);
}

export function isReviewPassUsed(jsonlPath) {
  try {
    return existsSync(reviewPassUsedPath(jsonlPath));
  } catch {
    return false;
  }
}

/** PASS を使い捨てた印（jsonl は残す） */
export function markReviewPassUsed(jsonlPath) {
  const flag = reviewPassUsedPath(jsonlPath);
  writeFileSync(flag, '', 'utf8');
  return flag;
}

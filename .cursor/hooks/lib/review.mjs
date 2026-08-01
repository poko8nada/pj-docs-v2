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
  } else if (review.reviewerTranscriptId) {
    reason = 'The recorded reviewer transcript does not end with `REVIEW: PASS`.';
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
 * agent-transcripts 置き場。
 * 実行時の transcript path から解決する。テストは
 * CURSOR_GATE_TRANSCRIPTS_DIR で上書きする。
 */
export function transcriptRootFromPath(transcriptPath) {
  if (!transcriptPath || typeof transcriptPath !== 'string') return null;
  const abs = resolve(transcriptPath);
  const id = idFromTranscriptPath(abs);
  if (!id || basename(dirname(abs)) !== id) return null;
  return dirname(dirname(abs));
}

export function agentTranscriptsDir() {
  const override = process.env.CURSOR_GATE_TRANSCRIPTS_DIR;
  if (override && String(override).trim()) return resolve(String(override).trim());
  return transcriptRootFromPath(process.env.CURSOR_TRANSCRIPT_PATH);
}

function transcriptPathFromId(transcriptId) {
  const dir = agentTranscriptsDir();
  const id = idFromTranscriptPath(transcriptId);
  if (!dir || !id) return null;
  return join(dir, id, `${id}.jsonl`);
}

/**
 * 子 agent の hook payload から reviewer transcript を特定する。
 * 親 state の id は sticky で解決済みなので、child id と比較して親イベントを除外する。
 */
export function reviewerTranscriptIdFromPayload(root, payload, parentId) {
  const path = transcriptPathFromPath(payload?.transcript_path);
  const childId = path ? idFromTranscriptPath(path) : null;
  if (!path || !childId || childId === String(parentId)) return null;
  if (!existsSync(path)) return null;

  let text;
  try {
    text = readFileSync(path, 'utf8');
  } catch {
    return null;
  }
  if (!isReviewerTranscriptText(root, text)) return null;
  return childId;
}

function transcriptPathFromPath(transcriptPath) {
  if (!transcriptPath || typeof transcriptPath !== 'string') return null;
  const abs = resolve(transcriptPath);
  return transcriptRootFromPath(abs) ? abs : null;
}

/** 本文中の最後の `REVIEW: PASS|GAPS`（大文字化）。無ければ null */
export function lastReviewVerdict(text) {
  // JSONL 生文字列では改行が `\n` エスケープのため、先頭 `\b` は使わない
  const re = /REVIEW:\s*(PASS|GAPS)\b/gi;
  let last = null;
  let m;
  while ((m = re.exec(String(text ?? ''))) !== null) {
    last = m[1].toUpperCase();
  }
  return last;
}

/**
 * 子 transcript がこの workspace の pre-commit reviewer 試行か（verdict は見ない）。
 * - 絶対 path 必須
 * - 署名: `pre-commit-reviewer` / `[harness-review]` / (`Full Repository Path:` + `Diff:`)
 */
export function isReviewerTranscriptText(root, text) {
  const body = String(text ?? '');
  const rootAbs = resolve(root);
  if (!body.includes(rootAbs)) return false;

  const hasType = /\bpre-commit-reviewer\b/i.test(body);
  const hasHarness = body.includes(REVIEW_INJECT_MARKER);
  // JSONL 生文字列では `\nDiff:` となり `\bDiff` が失敗するため単語境界は使わない
  const hasPromptShape = /Full Repository Path:/i.test(body) && /Diff:/i.test(body);
  return hasType || hasHarness || hasPromptShape;
}

/** reviewer 試行かつ最終 verdict が PASS */
export function isReviewPassTranscriptText(root, text) {
  return isReviewerTranscriptText(root, text) && lastReviewVerdict(text) === 'PASS';
}

/**
 * state に保存された reviewer transcript ID を優先して直接確認する。
 * ID が未保存の場合だけ、snapshotAt 以降の runtime transcript を fallback 走査する。
 * @returns {string | null}
 */
export function findReviewPassTranscript(
  root,
  excludeId = null,
  reviewerTranscriptId = null,
  snapshotAt = null,
) {
  if (reviewerTranscriptId) {
    const path = transcriptPathFromId(reviewerTranscriptId);
    return path ? readPassTranscript(root, path, excludeId) : null;
  }

  const snapshotAtMs = Date.parse(String(snapshotAt ?? ''));
  if (!Number.isFinite(snapshotAtMs)) return null;

  const dir = agentTranscriptsDir();
  if (!dir || !existsSync(dir)) return null;

  let names;
  try {
    names = readdirSync(dir);
  } catch {
    return null;
  }

  /** @type {{ mtimeMs: number, jsonl: string, text: string } | null} */
  let latest = null;

  for (const name of names) {
    if (excludeId && name === excludeId) continue;
    const jsonl = join(dir, name, `${name}.jsonl`);
    if (!existsSync(jsonl)) continue;
    if (isReviewPassUsed(jsonl)) continue;

    let st;
    try {
      st = statSync(jsonl);
    } catch {
      continue;
    }
    if (st.mtimeMs < snapshotAtMs) continue;
    let text;
    try {
      text = readFileSync(jsonl, 'utf8');
    } catch {
      continue;
    }
    if (!isReviewerTranscriptText(root, text)) continue;

    if (!latest || st.mtimeMs >= latest.mtimeMs) {
      latest = { mtimeMs: st.mtimeMs, jsonl, text };
    }
  }

  if (!latest) return null;
  if (lastReviewVerdict(latest.text) !== 'PASS') return null;
  return latest.jsonl;
}

function readPassTranscript(root, transcriptPath, excludeId = null) {
  const jsonl = transcriptPathFromPath(transcriptPath);
  if (!jsonl) return null;

  const id = idFromTranscriptPath(jsonl);
  if (excludeId && id === excludeId) return null;
  if (isReviewPassUsed(jsonl)) return null;

  let text;
  try {
    text = readFileSync(jsonl, 'utf8');
  } catch {
    return null;
  }
  if (!isReviewerTranscriptText(root, text)) return null;
  if (lastReviewVerdict(text) !== 'PASS') return null;
  return jsonl;
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

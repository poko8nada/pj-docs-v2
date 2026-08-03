/**
 * Pre-commit reviewer gate — commit Skill script と reviewer transcript の binding。
 */
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { isBootstrapMarkerPath } from './bootstrap.mjs';
import { formatDeny } from './deny-format.mjs';
import { idFromTranscriptPath, isUnderStateDir, sanitizeConversationId } from './state.mjs';

/** commit Skill と同じ reviewable 拡張子（Markdown は対象外）。 */
const REVIEWABLE_EXT = /\.(ts|tsx|js|jsx|mjs|cjs|css|html|json|yaml|yml)$/i;

export const REVIEW_SCRIPT_REL = '.cursor/skills/commit/scripts/review.mjs';
export const COMMIT_SCRIPT_REL = '.cursor/skills/commit/scripts/commit.mjs';
export const REVIEW_RESULT_REQUIRED = 'review_required';
export const REVIEW_RESULT_NOT_REQUIRED = 'no_review_required';
export const REVIEW_REQUIREMENT_REQUIRED = 'required';
export const REVIEW_REQUIREMENT_NOT_REQUIRED = 'not_required';
export const REVIEW_REQUIREMENT_UNKNOWN = 'unknown';

/** commit Skillのscript実行をheredoc除去後のShell commandから判定する。 */
function commandIncludesSkillScript(command, scriptPath) {
  return shellSegments(command).some((segment) => {
    const tokens = segment.trim().split(/\s+/).filter(Boolean);
    let index = 0;
    while (index < tokens.length && /^[A-Za-z_][A-Za-z0-9_]*=/.test(tokens[index])) index += 1;
    while (['command', 'time'].includes(tokens[index])) index += 1;

    if (basename(tokens[index] ?? '') === 'pnpm') {
      index += 1;
      if (tokens[index] === 'exec') index += 1;
    }
    const executable = basename(tokens[index] ?? '');
    if (executable !== 'node' && executable !== 'nodejs') return false;
    index += 1;

    while (index < tokens.length) {
      const token = tokens[index];
      if (token === '--check' || token === '-c' || token === '-e' || token === '--eval')
        return false;
      if (token === '-p' || token === '--print') return false;
      if (token === '--') {
        index += 1;
        const script = tokens[index];
        return script === scriptPath || script?.endsWith(`/${scriptPath}`);
      }
      if (token === '--require' || token === '-r' || token === '--import') {
        index += 2;
        continue;
      }
      if (token.startsWith('-')) {
        index += 1;
        continue;
      }
      return token === scriptPath || token.endsWith(`/${scriptPath}`);
    }
    return false;
  });
}

export function commandIncludesReviewScript(command) {
  return commandIncludesSkillScript(command, REVIEW_SCRIPT_REL);
}

export function commandIncludesCommitScript(command) {
  return commandIncludesSkillScript(command, COMMIT_SCRIPT_REL);
}

/** review scriptの結果payloadから、reviewer要否だけを取り出す。 */
export function reviewRequirementFromResult(result) {
  if (result?.ok !== true) return REVIEW_REQUIREMENT_UNKNOWN;
  if (result.status === REVIEW_RESULT_REQUIRED) return REVIEW_REQUIREMENT_REQUIRED;
  if (result.status === REVIEW_RESULT_NOT_REQUIRED) return REVIEW_REQUIREMENT_NOT_REQUIRED;
  return REVIEW_REQUIREMENT_UNKNOWN;
}

const REVIEW_RESULT_DIR = '.cursor/skills/commit/scripts/.tmp';

export function reviewResultArtifactPath(root, id) {
  return join(resolve(root), REVIEW_RESULT_DIR, `${sanitizeConversationId(id)}.result`);
}

export function readReviewResultArtifact(root, id) {
  const path = reviewResultArtifactPath(root, id);
  try {
    const status = readFileSync(path, 'utf8').trim();
    const requirement = reviewRequirementFromResult({ ok: true, status });
    if (requirement === REVIEW_REQUIREMENT_UNKNOWN) {
      return { ok: false, path, status, requirement, message: 'The review result is invalid.' };
    }
    return { ok: true, path, status, requirement };
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return { ok: false, path, missing: true, message: 'The review result is missing.' };
    }
    return {
      ok: false,
      path,
      message: `Unable to read the review result: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

export function denyCommitScriptMessage(reason) {
  const why =
    {
      missing_review_start:
        'The commit script was invoked before the review script was run for this conversation.',
      missing_result:
        'The review script result is missing or invalid for the current commit candidate.',
      reviewer_pass: 'A reviewer PASS has not been verified after the latest review script run.',
    }[reason] ?? 'The commit review gate is not satisfied.';

  return formatDeny({
    tag: 'gate-review',
    why,
    next: [
      'Run `node .cursor/skills/commit/scripts/review.mjs`.',
      'If it returns a reviewer request, invoke that request and require `REVIEW: PASS`.',
      'Retry `commit.mjs` only after the review result is satisfied.',
    ],
    doNot: [
      'Retry `commit.mjs` unchanged while the review gate is unsatisfied.',
      'Invoke a reviewer without the generated request.',
      'Use a raw `git commit` as a review bypass.',
    ],
  });
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

function shellSegments(command) {
  const cleaned = String(command ?? '')
    .replace(/<<-?\s*["']?(\w+)["']?[\s\S]*?\n\s*\1/g, ' ')
    .replace(/(["'])(?:\\.|(?!\1)[^\\])*\1/g, ' ');
  return cleaned
    .split(/&&|\|\||;|\n|\|/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** check state の後処理用に `git commit` を含むか判定する（review gateでは使わない）。 */
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
 * review開始時刻以降の PASS 候補と、親 transcript の最後の Subagent prompt を
 * whitespace-normalize して照合する。署名の推測や mtime 順の勝手な選択はせず、
 * 一意に一致した場合だけ path を返す。
 */
export function findReviewPassTranscript(root, parentId = null, reviewStartedAt = null) {
  const reviewStartedAtMs = Date.parse(String(reviewStartedAt ?? ''));
  if (!Number.isFinite(reviewStartedAtMs)) return null;

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
      if (st.mtimeMs < reviewStartedAtMs) continue;

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

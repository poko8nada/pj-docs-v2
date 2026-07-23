#!/usr/bin/env node
/**
 * track.mjs — state 更新のみ（deny しない）
 *
 * | Event              | Action                                      |
 * |--------------------|---------------------------------------------|
 * | beforeSubmitPrompt | phase / bootstrap                           |
 * | Read*              | unlock + read.skills / read.refs            |
 * | postToolUse Write* | review.pending + check.pending              |
 * | preToolUse Task         | inject review.files → reviewed on reviewer    |
 * | afterShellExecution     | git commit 成功 → review/check reset          |
 */
import { realpathSync } from 'node:fs';
import { isAbsolute, join, resolve } from 'node:path';
import { disableBootstrap, enableBootstrap } from './lib/bootstrap.mjs';
import { clearStubTurn, enableStubTurn, isMentorActive } from './lib/mentor.mjs';
import {
  commandIncludesGitCommit,
  injectReviewFilesIntoTaskInput,
  isPreCommitReviewerContext,
  isReviewablePath,
} from './lib/review.mjs';
import { skillRefIdFromPath } from './lib/refs.mjs';
import { ISSUE_SKILL_REL } from './lib/issue.mjs';
import { isCheckablePath } from './lib/check.mjs';
import { logHookIds } from './lib/id-log.mjs';
import {
  conversationId,
  defaultRead,
  findStateFileName,
  isReviewBlocking,
  loadState,
  markCheckPending,
  markReviewDirty,
  markReadRef,
  markReadSkill,
  clearReviewFiles,
  normalizeReview,
  normalizeCheck,
  PHASE_DISCUSSION,
  resetCheck,
  resetReview,
  saveState,
  skillNameFromPath,
  SPEC_FLOW_PHASES,
  WORK_PHASES,
  workspaceRoot,
  writeLastPromptId,
} from './lib/state.mjs';

const PHASE_RE = /(?:^|[\s`])\/(discussion|work|chore)(?=[\s`/]|$)/i;
const BOOTSTRAP_OFF_RE = /(?:^|[\s`])\/bootstrap\s+off(?=[\s`/]|$)/i;
const BOOTSTRAP_ON_RE = /(?:^|[\s`])\/bootstrap(?=[\s`/]|$)/i;
const MENTOR_OFF_RE = /(?:^|[\s`])\/mentor\s+off(?=[\s`/]|$)/i;
const MENTOR_ON_RE = /(?:^|[\s`])\/mentor(?=[\s`/]|$)/i;
const STUB_RE = /(?:^|[\s`])\/stub(?=[\s`/]|$)/i;

const WRITE_TOOLS = new Set(['Write', 'StrReplace', 'Delete', 'EditNotebook']);

async function readStdinJson() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  const text = Buffer.concat(chunks).toString('utf8').trim();
  if (!text) return {};
  return JSON.parse(text);
}

function respond(payload) {
  process.stdout.write(JSON.stringify(payload) + '\n');
}

function allow() {
  respond({ permission: 'allow' });
}

function empty() {
  respond({});
}

function filePathFromPayload(payload) {
  const toolInput = payload.tool_input ?? {};
  return (
    payload.file_path ??
    payload.filePath ??
    toolInput.path ??
    toolInput.filePath ??
    toolInput.file_path ??
    toolInput.file ??
    ''
  );
}

function isRulesSkill(root, filePath) {
  if (!filePath) return false;
  try {
    const abs = realpathSync(isAbsolute(filePath) ? filePath : resolve(root, filePath));
    const target = realpathSync(join(root, '.cursor/skills/rules/SKILL.md'));
    return abs === target;
  } catch {
    return false;
  }
}

function isIssueSkill(root, filePath) {
  if (!filePath) return false;
  try {
    const abs = realpathSync(isAbsolute(filePath) ? filePath : resolve(root, filePath));
    const target = realpathSync(join(root, ISSUE_SKILL_REL));
    return abs === target;
  } catch {
    return false;
  }
}

/** 任意の `.cursor/skills/<name>/SKILL.md` Read → read.skills */
function maybeMarkReadSkill(root, payload) {
  const filePath = filePathFromPayload(payload);
  const name = skillNameFromPath(root, String(filePath ?? ''));
  if (!name) return;
  const id = conversationId(payload);
  markReadSkill(root, id, name);
}

function maybeUnlockIssue(root, payload) {
  const filePath = filePathFromPayload(payload);
  if (!isIssueSkill(root, String(filePath))) return;
  const id = conversationId(payload);
  const prev = loadState(root, id);
  if (!SPEC_FLOW_PHASES.has(prev.phase)) return;
  saveState(root, id, {
    phase: prev.phase,
    unlock: { ...prev.unlock, issue: true },
  });
}

function maybeUnlockRules(root, payload) {
  const filePath = filePathFromPayload(payload);
  if (!isRulesSkill(root, String(filePath))) return;
  const id = conversationId(payload);
  const prev = loadState(root, id);
  if (WORK_PHASES.has(prev.phase)) {
    saveState(root, id, {
      phase: prev.phase,
      unlock: { ...prev.unlock, rules: true },
      review: prev.review,
    });
  }
}

/** 任意 skill の references 配下 md Read → read.refs（`skill/name.md`） */
function maybeMarkReadRef(root, payload) {
  const filePath = filePathFromPayload(payload);
  const ref = skillRefIdFromPath(root, String(filePath ?? ''));
  if (!ref) return;
  const id = conversationId(payload);
  markReadRef(root, id, ref);
}

function handleBeforeSubmitPrompt(root, payload) {
  const id = conversationId(payload);
  // ツール hooks は汚染されうるので、ユーザー発話で確定した id だけ sticky にする
  writeLastPromptId(root, id);
  // stub は1ターン限り — 新発話の冒頭で必ず消す（state には載せない）
  clearStubTurn(root);
  const prompt = String(payload.prompt ?? '');

  if (BOOTSTRAP_OFF_RE.test(prompt)) {
    disableBootstrap(root);
  } else if (BOOTSTRAP_ON_RE.test(prompt)) {
    enableBootstrap(root);
  }

  if (!findStateFileName(root, id)) {
    saveState(root, id, { phase: PHASE_DISCUSSION, unlock: { rules: null } });
  }

  if (MENTOR_OFF_RE.test(prompt)) {
    const prev = loadState(root, id);
    saveState(root, id, { phase: prev.phase, mentor: false });
  } else if (MENTOR_ON_RE.test(prompt)) {
    const prev = loadState(root, id);
    saveState(root, id, { phase: prev.phase, mentor: true });
  }

  // mentor OFF の /stub はハーネス no-op（sticky を立てない）
  const afterMentor = loadState(root, id);
  if (STUB_RE.test(prompt) && isMentorActive(afterMentor)) {
    enableStubTurn(root, id);
  }

  const match = prompt.match(PHASE_RE);
  if (!match) return respond({ continue: true });

  const phase = match[1].toLowerCase();
  const prev = loadState(root, id);
  let unlock;
  // review.files はフェーズ変更・再入場でも残す（clear は reviewer / commit のみ）
  const review = normalizeReview(prev.review);
  // phase 再入場: read はクリア（skills / refs）
  const read = defaultRead();

  if (phase === PHASE_DISCUSSION) {
    unlock = { rules: null, issue: null };
  } else if (phase === 'chore') {
    unlock = { rules: false, issue: null };
  } else {
    // work — rules on entry; issue stays false until issue writes
    unlock = { rules: false, issue: false };
  }

  // mentor はフェーズ変更でも維持
  saveState(root, id, { phase, unlock, read, review, mentor: prev.mentor });
  return respond({ continue: true });
}

function maybeMarkCheckPending(root, payload) {
  const id = conversationId(payload);
  const state = loadState(root, id);
  if (!WORK_PHASES.has(state.phase) || state.unlock?.rules !== true) return;

  const filePath = filePathFromPayload(payload);
  if (!filePath || !isCheckablePath(root, String(filePath))) return;

  const abs = resolve(
    isAbsolute(String(filePath)) ? String(filePath) : resolve(root, String(filePath)),
  );
  markCheckPending(root, id, abs);
}

function maybeMarkReviewDirty(root, payload) {
  const id = conversationId(payload);
  const state = loadState(root, id);
  if (!WORK_PHASES.has(state.phase) || state.unlock?.rules !== true) return;

  const filePath = filePathFromPayload(payload);
  if (!filePath || !isReviewablePath(root, String(filePath))) return;

  const abs = resolve(
    isAbsolute(String(filePath)) ? String(filePath) : resolve(root, String(filePath)),
  );
  markReviewDirty(root, id, abs);
}

function handlePreToolUseTask(root, payload) {
  if (!isPreCommitReviewerContext(payload)) return allow();

  const id = conversationId(payload);
  const state = loadState(root, id);
  if (!isReviewBlocking(state)) return allow();

  const files = [...normalizeReview(state.review).files];
  const toolInput = payload.tool_input ?? {};
  const updatedInput = injectReviewFilesIntoTaskInput(toolInput, root, files);
  clearReviewFiles(root, id);

  if (updatedInput) {
    return respond({ permission: 'allow', updated_input: updatedInput });
  }
  return allow();
}

function shellCommand(payload) {
  return String(payload.command ?? payload.tool_input?.command ?? '');
}

function shellSucceeded(payload) {
  if (payload.success === false) return false;
  const code = payload.exit_code ?? payload.exitCode ?? payload.exit_status;
  if (code !== undefined && code !== null) return Number(code) === 0;
  return true;
}

/** 成功した git commit だけ review/check クリア（試行時点では reset しない） */
function handleAfterShellExecution(root, payload) {
  const command = shellCommand(payload);
  if (!shellSucceeded(payload)) return empty();

  if (!commandIncludesGitCommit(command)) return empty();

  const id = conversationId(payload);
  const state = loadState(root, id);
  const hadCheck = normalizeCheck(state.check).pending.length > 0;

  resetReview(root, id);
  if (hadCheck) resetCheck(root, id);
  return empty();
}

async function main() {
  const payload = await readStdinJson();
  logHookIds(payload, 'track.mjs');
  const root = workspaceRoot(payload);
  const event = payload.hook_event_name ?? '';
  const toolName = payload.tool_name ?? '';

  if (event === 'beforeSubmitPrompt') {
    return handleBeforeSubmitPrompt(root, payload);
  }

  if (event === 'afterShellExecution') {
    return handleAfterShellExecution(root, payload);
  }

  // beforeShellExecution: commit 試行では reset しない（空コミットすり抜け防止）
  if (event === 'beforeShellExecution') {
    return empty();
  }

  if (event === 'preToolUse' && toolName === 'Task') {
    return handlePreToolUseTask(root, payload);
  }

  const isReadTool = toolName === 'Read' || toolName === 'ReadFile';
  const isReadEvent =
    event === 'beforeReadFile' ||
    ((event === 'preToolUse' || event === 'postToolUse') && isReadTool);

  if (isReadEvent) {
    maybeMarkReadSkill(root, payload);
    maybeUnlockIssue(root, payload);
    maybeUnlockRules(root, payload);
    maybeMarkReadRef(root, payload);
    if (event === 'postToolUse') return empty();
    return allow();
  }

  if (event === 'postToolUse' && WRITE_TOOLS.has(toolName)) {
    maybeMarkReviewDirty(root, payload);
    maybeMarkCheckPending(root, payload);
    return empty();
  }

  if (event === 'beforeReadFile') return allow();
  return empty();
}

main().catch(() => {
  respond({ continue: true });
});

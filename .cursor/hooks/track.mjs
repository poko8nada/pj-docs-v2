#!/usr/bin/env node
/**
 * track.mjs — state 更新のみ（deny しない）
 *
 * | Event              | Action                                      |
 * |--------------------|---------------------------------------------|
 * | beforeSubmitPrompt | phase / bootstrap                           |
 * | Read*              | implement: true on implement/SKILL.md Read  |
 * | postToolUse Write* | review.pending + check.pending              |
 * | preToolUse Task         | inject review.files → reviewed on reviewer    |
 * | beforeShellExecution    | review/check reset when git commit allowed  |
 * | afterShellExecution     | review/check reset on successful git commit (IDE) |
 */
import { realpathSync } from 'node:fs';
import { isAbsolute, join, resolve } from 'node:path';
import { disableBootstrap, enableBootstrap } from './_bootstrap.mjs';
import {
  commandIncludesGitCommit,
  injectReviewFilesIntoTaskInput,
  isPreCommitReviewerContext,
  isReviewablePath,
} from './_review.mjs';
import { isCheckablePath } from './_check.mjs';
import {
  conversationId,
  defaultReview,
  findStateFileName,
  isReviewBlocking,
  loadState,
  markCheckPending,
  markReviewDirty,
  markReviewed,
  normalizeImplement,
  normalizeReview,
  normalizeCheck,
  PHASE_DISCUSSION,
  resetCheck,
  resetReview,
  REVIEW_IDLE,
  REVIEW_REVIEWED,
  saveState,
  WORK_PHASES,
  workspaceRoot,
} from './_state.mjs';

const PHASE_RE = /(?:^|[\s`])\/(discussion|spec|design|forge|refine|chore)(?=[\s`/]|$)/i;
const BOOTSTRAP_OFF_RE = /(?:^|[\s`])\/bootstrap\s+off(?=[\s`/]|$)/i;
const BOOTSTRAP_ON_RE = /(?:^|[\s`])\/bootstrap(?=[\s`/]|$)/i;

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

function isImplementSkill(root, filePath) {
  if (!filePath) return false;
  try {
    const abs = realpathSync(isAbsolute(filePath) ? filePath : resolve(root, filePath));
    const target = realpathSync(join(root, '.cursor/skills/implement/SKILL.md'));
    return abs === target;
  } catch {
    return false;
  }
}

function maybeUnlockImplement(root, payload) {
  const filePath = filePathFromPayload(payload);
  if (!isImplementSkill(root, String(filePath))) return;
  const id = conversationId(payload);
  const prev = loadState(root, id);
  if (WORK_PHASES.has(prev.phase)) {
    saveState(root, id, { phase: prev.phase, implement: true, review: prev.review });
  }
}

function handleBeforeSubmitPrompt(root, payload) {
  const id = conversationId(payload);
  const prompt = String(payload.prompt ?? '');

  if (BOOTSTRAP_OFF_RE.test(prompt)) {
    disableBootstrap(root);
  } else if (BOOTSTRAP_ON_RE.test(prompt)) {
    enableBootstrap(root);
  }

  if (!findStateFileName(root, id)) {
    saveState(root, id, { phase: PHASE_DISCUSSION, implement: null });
  }

  const match = prompt.match(PHASE_RE);
  if (!match) return respond({ continue: true });

  const phase = match[1].toLowerCase();
  const prev = loadState(root, id);
  let implement;
  let review = normalizeReview(prev.review);

  if (phase === PHASE_DISCUSSION) {
    implement = null;
    review = defaultReview();
  } else if (prev.phase === phase) {
    implement = normalizeImplement(phase, prev.implement);
  } else {
    implement = false;
    review = defaultReview();
  }

  saveState(root, id, { phase, implement, review });
  return respond({ continue: true });
}

function maybeMarkCheckPending(root, payload) {
  const id = conversationId(payload);
  const state = loadState(root, id);
  if (!WORK_PHASES.has(state.phase) || state.implement !== true) return;

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
  if (!WORK_PHASES.has(state.phase) || state.implement !== true) return;

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
  const updatedInput = injectReviewFilesIntoTaskInput(toolInput, files);
  markReviewed(root, id);

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

function maybeResetAfterCommit(root, payload) {
  const command = shellCommand(payload);
  if (!commandIncludesGitCommit(command)) return empty();

  const id = conversationId(payload);
  const state = loadState(root, id);
  if (isReviewBlocking(state)) return empty();

  const review = normalizeReview(state.review);
  const hadCheck = normalizeCheck(state.check).pending.length > 0;

  // reviewed（レビュー起動済み）のとき idle へ。idle のままなら何もしない。
  if (review.status === REVIEW_REVIEWED) resetReview(root, id);
  if (hadCheck) resetCheck(root, id);
  return empty();
}

function handleAfterShellExecution(root, payload) {
  const command = shellCommand(payload);
  if (!commandIncludesGitCommit(command) || !shellSucceeded(payload)) return empty();

  const id = conversationId(payload);
  const state = loadState(root, id);
  const review = normalizeReview(state.review);
  const hadCheck = normalizeCheck(state.check).pending.length > 0;

  if (review.status !== REVIEW_IDLE) resetReview(root, id);
  if (hadCheck) resetCheck(root, id);
  return empty();
}

async function main() {
  const payload = await readStdinJson();
  const root = workspaceRoot(payload);
  const event = payload.hook_event_name ?? '';
  const toolName = payload.tool_name ?? '';

  if (event === 'beforeSubmitPrompt') {
    return handleBeforeSubmitPrompt(root, payload);
  }

  if (event === 'afterShellExecution') {
    return handleAfterShellExecution(root, payload);
  }

  if (event === 'beforeShellExecution') {
    return maybeResetAfterCommit(root, payload);
  }

  if (event === 'preToolUse' && toolName === 'Task') {
    return handlePreToolUseTask(root, payload);
  }

  const isReadTool = toolName === 'Read' || toolName === 'ReadFile';
  const isReadEvent =
    event === 'beforeReadFile' ||
    ((event === 'preToolUse' || event === 'postToolUse') && isReadTool);

  if (isReadEvent) {
    maybeUnlockImplement(root, payload);
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

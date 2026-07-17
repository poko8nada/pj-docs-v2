#!/usr/bin/env node
/**
 * track.mjs — state 更新のみ（deny しない）
 *
 * | Event              | Action                                      |
 * |--------------------|---------------------------------------------|
 * | beforeSubmitPrompt | phase / bootstrap                           |
 * | Read*              | implement unlock + readRefs on references/*.md |
 * | postToolUse Write* | review.pending + check.pending              |
 * | preToolUse Task         | inject review.files → reviewed on reviewer    |
 * | afterShellExecution     | git commit 成功 → review/check reset          |
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
import { implementRefBasename } from './_refs.mjs';
import { isCheckablePath } from './_check.mjs';
import {
  conversationId,
  defaultReview,
  findStateFileName,
  isReviewBlocking,
  loadState,
  markCheckPending,
  markReviewDirty,
  markReadRef,
  clearReviewFiles,
  normalizeReview,
  normalizeCheck,
  PHASE_DISCUSSION,
  resetCheck,
  resetReview,
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

/** implement/references/*.md の Read を readRefs に記録（作業フェーズ中） */
function maybeMarkReadRef(root, payload) {
  const filePath = filePathFromPayload(payload);
  const ref = implementRefBasename(root, String(filePath ?? ''));
  if (!ref) return;
  const id = conversationId(payload);
  const state = loadState(root, id);
  if (!WORK_PHASES.has(state.phase)) return;
  markReadRef(root, id, ref);
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
  let readRefs = [...(prev.readRefs ?? [])];

  if (phase === PHASE_DISCUSSION) {
    implement = null;
    review = defaultReview();
    readRefs = [];
  } else {
    // 作業フェーズ入場・再入場＝作業単位の境界
    implement = false;
    readRefs = [];
    if (prev.phase !== phase) {
      review = defaultReview();
    }
  }

  saveState(root, id, { phase, implement, review, readRefs });
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
    maybeUnlockImplement(root, payload);
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

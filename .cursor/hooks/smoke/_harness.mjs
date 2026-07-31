/**
 * smoke 共有 — run / assert / 一時 state / track helpers。
 * 使い方は run.mjs。一時ファイルは `.cursor/hooks/.smoke-tmp/`。
 */
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import {
  bootstrapMarkerPath,
  disableBootstrap,
  enableBootstrap,
  isBootstrapActive,
} from '../lib/bootstrap.mjs';
import { clearStubTurn, isStubTurnActive, lastStubPath } from '../lib/mentor.mjs';
import {
  findStateFileName,
  formatJstIso,
  idFromTranscriptPath,
  lastPromptIdPath,
  loadState,
  onSessionStart,
  PHASE_DISCUSSION,
  purgeStaleStates,
  readLastPromptId,
  saveState,
  STATE_TTL_DAYS,
  workspaceRoot,
} from '../lib/state.mjs';
import { buildReviewTaskInjection, collectReviewDiff, isReviewablePath } from '../lib/review.mjs';
import { isCheckToolingReady, runFormatLint } from '../lib/check.mjs';

const smokeDir = fileURLToPath(new URL('.', import.meta.url));
/** hooks ディレクトリ（本番スクリプトの場所） */
export const hooksDir = resolve(smokeDir, '..');
export const root = resolve(hooksDir, '../..');
export const smokeTmpRoot = join(hooksDir, '.smoke-tmp');

/**
 * @typedef {ReturnType<typeof createSmokeCtx>} SmokeCtx
 */

/** smoke 実行用コンテキストを作る。caller は finally で finishSmokeCtx すること。 */
export function createSmokeCtx() {
  mkdirSync(smokeTmpRoot, { recursive: true });
  const stateTmp = mkdtempSync(join(smokeTmpRoot, 'state-'));
  const id = 'test-conversation';
  const restoreBootstrap = isBootstrapActive(root);
  let failed = 0;

  process.env.CURSOR_GATE_STATE_DIR = stateTmp;
  delete process.env.CURSOR_GATE_BOOTSTRAP;
  disableBootstrap(root);

  function clearSticky() {
    try {
      unlinkSync(lastPromptIdPath(root));
    } catch {
      // 無ければ無視
    }
    clearStubTurn(root);
  }

  function run(script, payload, hookEnv = {}) {
    const r = spawnSync(process.execPath, [join(hooksDir, script)], {
      input: JSON.stringify(payload),
      encoding: 'utf8',
      env: {
        ...process.env,
        CURSOR_GATE_STATE_DIR: stateTmp,
        ...hookEnv,
      },
    });
    if (r.status !== 0) {
      throw new Error(`${script} exited ${r.status}: ${r.stderr}`);
    }
    const line = (r.stdout || '').trim().split('\n').filter(Boolean).pop() || '{}';
    return JSON.parse(line);
  }

  function assert(name, cond, detail = '') {
    if (cond) {
      process.stdout.write(`ok  - ${name}\n`);
    } else {
      failed += 1;
      process.stderr.write(`FAIL - ${name}${detail ? `: ${detail}` : ''}\n`);
    }
  }

  function stateAbs() {
    const name = findStateFileName(root, id);
    if (!name) throw new Error('state file missing');
    return join(stateTmp, name);
  }

  function readState() {
    return JSON.parse(readFileSync(stateAbs(), 'utf8'));
  }

  function trackRead(convBase, relPath) {
    run('track.mjs', {
      ...convBase,
      hook_event_name: 'preToolUse',
      tool_name: 'ReadFile',
      tool_input: { path: join(root, relPath) },
    });
  }

  function trackReadTsRef(convBase) {
    trackRead(convBase, '.cursor/skills/rules/references/shared.md');
  }

  function trackReadIssueSkill(convBase) {
    trackRead(convBase, '.cursor/skills/issue/SKILL.md');
  }

  function trackReadScope(convBase) {
    trackRead(convBase, '.cursor/skills/scope/SKILL.md');
  }

  function trackReadAgenda(convBase) {
    trackRead(convBase, '.cursor/skills/agenda/SKILL.md');
  }

  function trackReadBuildTemplate(convBase) {
    trackRead(convBase, '.cursor/skills/issue/references/build-template.md');
  }

  const base = {
    conversation_id: id,
    workspace_roots: [root],
    cwd: root,
  };

  return {
    root,
    hooksDir,
    stateTmp,
    smokeTmpRoot,
    id,
    base,
    restoreBootstrap,
    get failed() {
      return failed;
    },
    bumpFailed() {
      failed += 1;
    },
    run,
    assert,
    clearSticky,
    trackRead,
    trackReadTsRef,
    trackReadIssueSkill,
    trackReadScope,
    trackReadAgenda,
    trackReadBuildTemplate,
    stateAbs,
    readState,
    findStateFileName,
    formatJstIso,
    idFromTranscriptPath,
    lastPromptIdPath,
    loadState,
    onSessionStart,
    PHASE_DISCUSSION,
    purgeStaleStates,
    readLastPromptId,
    saveState,
    STATE_TTL_DAYS,
    workspaceRoot,
    bootstrapMarkerPath,
    disableBootstrap,
    enableBootstrap,
    isBootstrapActive,
    clearStubTurn,
    isStubTurnActive,
    lastStubPath,
    buildReviewTaskInjection,
    collectReviewDiff,
    isReviewablePath,
    isCheckToolingReady,
    runFormatLint,
    existsSync,
    mkdirSync,
    mkdtempSync,
    readdirSync,
    readFileSync,
    rmSync,
    unlinkSync,
    writeFileSync,
    join,
    resolve,
  };
}

/** 一時ディレクトリ掃除と bootstrap 復元。失敗数を返す。 */
export function finishSmokeCtx(ctx) {
  const { stateTmp, smokeTmpRoot: tmpRoot, restoreBootstrap } = ctx;
  rmSync(stateTmp, { recursive: true, force: true });
  rmSync(tmpRoot, { recursive: true, force: true });
  if (restoreBootstrap) enableBootstrap(root);
  else disableBootstrap(root);

  let failed = ctx.failed;
  if (existsSync(tmpRoot)) {
    failed += 1;
    process.stderr.write('FAIL - smoke-tmp cleaned up\n');
  } else {
    process.stdout.write('ok  - smoke-tmp cleaned up\n');
  }
  return failed;
}

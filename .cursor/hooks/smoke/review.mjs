/** smoke: review */
import { execFileSync } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';
import { agentTranscriptsDir, reviewPassUsedPath } from '../lib/review.mjs';
import { REVIEW_BINDING_BOUND, REVIEW_BINDING_UNBOUND } from '../lib/state.mjs';

function execGitWithoutSmokeIndex(cwd, gitArgs, options = {}) {
  const env = { ...process.env };
  delete env.GIT_INDEX_FILE;
  return execFileSync('git', gitArgs, { ...options, cwd, env });
}

function withRealGitIndex(callback) {
  const previousGitIndexFile = process.env.GIT_INDEX_FILE;
  delete process.env.GIT_INDEX_FILE;
  try {
    return callback();
  } finally {
    if (previousGitIndexFile === undefined) delete process.env.GIT_INDEX_FILE;
    else process.env.GIT_INDEX_FILE = previousGitIndexFile;
  }
}

/** @param {import('./_harness.mjs').SmokeCtx} smoke */
export function runReviewGate(smoke) {
  const {
    root,
    run,
    assert,
    base,
    id,
    stateAbs,
    readFileSync,
    loadState,
    collectReviewSnapshot,
    collectReviewDiff,
    buildReviewTaskInjection,
    unlinkSync,
    writeFileSync,
    mkdirSync,
    mkdtempSync,
    utimesSync,
    smokeTmpRoot,
    clearSticky,
    resolve,
    join,
  } = smoke;

  function setupChore(conversationId) {
    const conversationBase = {
      conversation_id: conversationId,
      workspace_roots: [root],
      cwd: root,
    };
    run('track.mjs', {
      ...conversationBase,
      hook_event_name: 'beforeSubmitPrompt',
      prompt: '/scope ok',
    });
    run('track.mjs', {
      ...conversationBase,
      hook_event_name: 'beforeSubmitPrompt',
      prompt: '/chore review smoke',
    });
    run('track.mjs', {
      ...conversationBase,
      hook_event_name: 'preToolUse',
      tool_name: 'ReadFile',
      tool_input: { path: join(root, '.cursor/skills/scope/SKILL.md') },
    });
    run('track.mjs', {
      ...conversationBase,
      hook_event_name: 'preToolUse',
      tool_name: 'ReadFile',
      tool_input: { path: join(root, '.cursor/skills/rules/SKILL.md') },
    });
    return conversationBase;
  }

  function addIgnoredProbe(relPath) {
    execFileSync('git', ['add', '-N', '-f', '--', relPath], {
      cwd: root,
      stdio: 'ignore',
    });
  }

  function resetIgnoredProbe(relPath) {
    execFileSync('git', ['reset', '-q', '--', relPath], {
      cwd: root,
      stdio: 'ignore',
    });
  }

  function collectSnapshotWithoutSmokeIndex(cwd) {
    return withRealGitIndex(() => collectReviewSnapshot(cwd));
  }

  function collectDiffWithoutSmokeIndex(cwd, relPath) {
    return withRealGitIndex(() => collectReviewDiff(cwd, relPath));
  }

  const parentTranscriptId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

  function transcriptPath(dir, transcriptId) {
    return join(dir, transcriptId, `${transcriptId}.jsonl`);
  }

  function writeParentTranscript(dir, prompt, transcriptId = parentTranscriptId) {
    const path = transcriptPath(dir, transcriptId);
    mkdirSync(join(dir, transcriptId), { recursive: true });
    writeFileSync(
      path,
      `${JSON.stringify({
        role: 'assistant',
        message: {
          content: [
            {
              type: 'tool_use',
              name: 'Subagent',
              input: { prompt },
            },
          ],
        },
      })}\n`,
    );
    return path;
  }

  function writeReviewerTranscript(dir, transcriptId, verdict, prompt, previousPrompt = null) {
    const childDir = join(dir, transcriptId);
    mkdirSync(childDir, { recursive: true });
    const path = join(childDir, `${transcriptId}.jsonl`);
    const prompts = [previousPrompt, prompt].filter((value) => value);
    writeFileSync(
      path,
      `${prompts
        .map((text) =>
          JSON.stringify({
            role: 'user',
            message: {
              content: [
                {
                  type: 'text',
                  text,
                },
              ],
            },
          }),
        )
        .join('\n')}\n${JSON.stringify({
        role: 'assistant',
        message: { content: [{ type: 'text', text: `${verdict}\n` }] },
      })}\n`,
    );
    return path;
  }

  function runWithTranscripts(
    script,
    payload,
    transcriptsDir,
    runtimeTranscriptId = parentTranscriptId,
  ) {
    return run(script, payload, {
      CURSOR_GATE_TRANSCRIPTS_DIR: transcriptsDir,
      CURSOR_TRANSCRIPT_PATH: transcriptPath(transcriptsDir, runtimeTranscriptId),
    });
  }

  // Git snapshot: staged / unstaged / deleted / untracked と拡張子 filter
  {
    const gitRoot = mkdtempSync(join(smokeTmpRoot, 'review-snapshot-git-'));
    const trackedPath = join(gitRoot, 'tracked.mjs');
    const stagedPath = join(gitRoot, 'staged.mjs');
    const deletedPath = join(gitRoot, 'deleted.mjs');
    const untrackedPath = join(gitRoot, 'untracked.mjs');
    writeFileSync(trackedPath, 'export const tracked = 1;\n');
    writeFileSync(stagedPath, 'export const staged = 1;\n');
    writeFileSync(deletedPath, 'export const deleted = 1;\n');
    execGitWithoutSmokeIndex(gitRoot, ['init', '-q']);
    execGitWithoutSmokeIndex(gitRoot, ['add', '.']);
    execGitWithoutSmokeIndex(gitRoot, [
      '-c',
      'user.name=Smoke',
      '-c',
      'user.email=smoke@example.invalid',
      'commit',
      '-qm',
      'init',
    ]);
    writeFileSync(trackedPath, 'export const tracked = 2;\n');
    writeFileSync(stagedPath, 'export const staged = 2;\n');
    execGitWithoutSmokeIndex(gitRoot, ['add', 'staged.mjs']);
    unlinkSync(deletedPath);
    writeFileSync(untrackedPath, 'export const untracked = 1;\n');

    const snapshot = collectSnapshotWithoutSmokeIndex(gitRoot);
    assert(
      'snapshot includes staged, unstaged, deleted, and untracked paths',
      snapshot.kind === 'snapshot' &&
        snapshot.paths.includes('tracked.mjs') &&
        snapshot.paths.includes('staged.mjs') &&
        snapshot.paths.includes('deleted.mjs') &&
        snapshot.paths.includes('untracked.mjs') &&
        snapshot.hash?.startsWith('sha256:'),
      JSON.stringify(snapshot),
    );
    assert(
      'deleted tracked file is represented by diff',
      collectDiffWithoutSmokeIndex(gitRoot, 'deleted.mjs').kind === 'diff',
      JSON.stringify(collectDiffWithoutSmokeIndex(gitRoot, 'deleted.mjs')),
    );
    writeFileSync(join(gitRoot, 'ignored.md'), '# ignored from review\n');
    const filtered = collectSnapshotWithoutSmokeIndex(gitRoot);
    assert(
      'non-code extension is excluded from snapshot',
      filtered.kind === 'snapshot' && !filtered.paths.includes('ignored.md'),
      JSON.stringify(filtered),
    );
    rmSync(gitRoot, { recursive: true, force: true });
  }

  // reviewer Task はその時点の Git snapshot を保存し、同じ内容だけを注入する
  {
    const reviewId = 'abababab-abab-4bab-8bab-abababababab';
    const reviewBase = setupChore(reviewId);
    const probe = '.cursor/hooks/_smoke-review-snapshot-probe.mjs';
    const probeAbs = join(root, probe);
    const deletionAnchor = '.cursor/hooks/_smoke-review-deletion-anchor.mjs';
    const deletionAnchorAbs = join(root, deletionAnchor);
    const transcriptsDir = mkdtempSync(join(smokeTmpRoot, 'review-snapshot-tx-'));
    writeFileSync(probeAbs, 'export const smokeReviewSnapshotProbe = 1;\n');
    addIgnoredProbe(probe);
    run('track.mjs', {
      ...reviewBase,
      hook_event_name: 'postToolUse',
      tool_name: 'Read',
    });
    assert(
      'Read does not refresh reviewer snapshot',
      loadState(root, reviewId).review.snapshotHash == null,
      JSON.stringify(loadState(root, reviewId).review),
    );
    run('track.mjs', {
      ...reviewBase,
      hook_event_name: 'postToolUse',
      tool_name: 'Write',
      tool_input: { path: probeAbs },
    });
    assert(
      'parent Write refreshes reviewer snapshot',
      typeof loadState(root, reviewId).review.snapshotHash === 'string',
      JSON.stringify(loadState(root, reviewId).review),
    );

    const beforeTask = runWithTranscripts(
      'gate.mjs',
      {
        ...reviewBase,
        hook_event_name: 'beforeShellExecution',
        command: 'git commit -m test',
      },
      transcriptsDir,
    );
    assert(
      'commit denies before reviewer PASS',
      beforeTask.permission === 'deny' &&
        String(beforeTask.agent_message ?? '').includes('No verified reviewer PASS') &&
        typeof loadState(root, reviewId).review.snapshotHash === 'string',
      JSON.stringify(beforeTask),
    );

    const current = collectReviewSnapshot(root);
    const taskOut = run('track.mjs', {
      ...reviewBase,
      hook_event_name: 'preToolUse',
      tool_name: 'Task',
      tool_input: {
        subagent_type: 'pre-commit-reviewer',
        description: 'review current changes',
      },
    });
    const afterTask = loadState(root, reviewId);
    assert(
      'Task stores current snapshot hash',
      current.kind === 'snapshot' &&
        afterTask.review.snapshotHash === current.hash &&
        afterTask.review.snapshotAt?.endsWith('+09:00') &&
        afterTask.review.snapshotAt?.includes('.') &&
        afterTask.review.reviewerTranscriptId == null &&
        afterTask.review.binding === REVIEW_BINDING_UNBOUND,
      JSON.stringify({ current, review: afterTask.review }),
    );
    assert(
      'Task injects current snapshot diff',
      taskOut.permission === 'allow' &&
        taskOut.updated_input?.description?.includes('[harness-review]') &&
        taskOut.updated_input?.description?.includes(`Full Repository Path: ${resolve(root)}`) &&
        taskOut.updated_input?.description?.includes('Diff: current Git snapshot') &&
        taskOut.updated_input?.description?.includes('current Git snapshot') &&
        collectReviewDiff(root, probe).kind === 'diff' &&
        buildReviewTaskInjection(root, [probe])?.includes('smokeReviewSnapshotProbe'),
      JSON.stringify(taskOut),
    );

    writeFileSync(probeAbs, 'export const smokeReviewSnapshotProbe = 2;\n');
    const changedSnapshot = collectReviewSnapshot(root);
    const changed = runWithTranscripts(
      'gate.mjs',
      {
        ...reviewBase,
        hook_event_name: 'beforeShellExecution',
        command: 'git commit -m test',
      },
      transcriptsDir,
    );
    const reboundState = loadState(root, reviewId);
    assert(
      'commit denies when current snapshot changes',
      changed.permission === 'deny' &&
        reboundState.review.snapshotHash === changedSnapshot.hash &&
        reboundState.review.binding === REVIEW_BINDING_UNBOUND,
      JSON.stringify({ changed, review: reboundState.review }),
    );

    // 修正後の snapshot に対する GAPS → 新しい PASS の retry
    const retryTask = run('track.mjs', {
      ...reviewBase,
      hook_event_name: 'preToolUse',
      tool_name: 'Task',
      tool_input: {
        subagent_type: 'pre-commit-reviewer',
        description: 'review retry changes',
      },
    });
    assert(
      'retry Task refreshes snapshot injection',
      retryTask.updated_input?.description?.includes('[harness-review]') &&
        collectReviewDiff(root, probe).body.includes('smokeReviewSnapshotProbe = 2'),
      JSON.stringify(retryTask),
    );
    const retryPrompt = retryTask.updated_input?.prompt;
    writeParentTranscript(transcriptsDir, retryPrompt, reviewId);
    const gapsId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
    writeReviewerTranscript(transcriptsDir, gapsId, 'REVIEW: GAPS', retryPrompt);
    assert(
      'GAPS child is not captured before validation',
      loadState(root, reviewId).review.reviewerTranscriptId == null &&
        loadState(root, reviewId).review.binding === REVIEW_BINDING_UNBOUND &&
        !JSON.stringify(loadState(root, reviewId).review).includes(transcriptsDir),
      JSON.stringify(loadState(root, reviewId).review),
    );
    const gapsCommit = runWithTranscripts(
      'gate.mjs',
      {
        ...reviewBase,
        hook_event_name: 'beforeShellExecution',
        command: 'git commit -m test',
      },
      transcriptsDir,
    );
    assert('GAPS child still blocks commit', gapsCommit.permission === 'deny');

    const passId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
    const passPath = writeReviewerTranscript(
      transcriptsDir,
      passId,
      'REVIEW: PASS',
      retryPrompt.replace(/\n/g, '  '),
    );
    const passCommit = runWithTranscripts(
      'gate.mjs',
      {
        ...reviewBase,
        hook_event_name: 'beforeShellExecution',
        command: 'git commit -m test',
      },
      transcriptsDir,
    );
    const bound = loadState(root, reviewId);
    assert(
      'PASS for current snapshot binds review gate',
      passCommit.permission === 'allow' &&
        bound.review.snapshotHash === changedSnapshot.hash &&
        bound.review.snapshotAt !== null &&
        bound.review.binding === REVIEW_BINDING_BOUND,
      JSON.stringify({ passCommit, review: bound.review }),
    );
    assert('PASS transcript is marked used', existsSync(reviewPassUsedPath(passPath)));
    const boundRetry = runWithTranscripts(
      'gate.mjs',
      {
        ...reviewBase,
        hook_event_name: 'beforeShellExecution',
        command: 'git commit -m test',
      },
      transcriptsDir,
    );
    assert(
      'bound review allows a repeated commit check',
      boundRetry.permission === 'allow' &&
        loadState(root, reviewId).review.binding === REVIEW_BINDING_BOUND,
      JSON.stringify(boundRetry),
    );
    run('track.mjs', {
      ...reviewBase,
      hook_event_name: 'afterShellExecution',
      command: 'git commit -m test',
      success: true,
    });
    const committed = loadState(root, reviewId);
    assert(
      'successful commit clears bound review',
      committed.review.snapshotHash == null &&
        committed.review.snapshotAt == null &&
        committed.review.reviewerTranscriptId == null &&
        committed.review.binding == null,
      JSON.stringify(committed.review),
    );

    // reviewer PASS 後に probe を削除しても、現在差分を再計算する
    writeFileSync(probeAbs, 'export const smokeReviewSnapshotProbe = 3;\n');
    writeFileSync(deletionAnchorAbs, 'export const smokeReviewDeletionAnchor = 1;\n');
    resetIgnoredProbe(probe);
    addIgnoredProbe(deletionAnchor);
    run('track.mjs', {
      ...reviewBase,
      hook_event_name: 'preToolUse',
      tool_name: 'Task',
      tool_input: {
        subagent_type: 'pre-commit-reviewer',
        description: 'review deletion edge',
      },
    });
    unlinkSync(probeAbs);
    const afterDelete = collectReviewSnapshot(root);
    const deleteCommit = runWithTranscripts(
      'gate.mjs',
      {
        ...reviewBase,
        hook_event_name: 'beforeShellExecution',
        command: 'git commit -m test',
      },
      transcriptsDir,
    );
    assert(
      'deleted untracked file is removed from current snapshot',
      afterDelete.kind === 'snapshot' &&
        afterDelete.paths.includes(deletionAnchor) &&
        !afterDelete.paths.includes(probe) &&
        deleteCommit.permission === 'deny',
      JSON.stringify({ afterDelete, deleteCommit }),
    );
    try {
      unlinkSync(deletionAnchorAbs);
      resetIgnoredProbe(deletionAnchor);
    } catch {
      // 無ければ無視
    }
  }

  // 子 hook が発火しなくても fallback は現在 snapshot の時刻以降だけを見る
  {
    const fallbackId = 'acacacac-acac-4cac-8cac-acacacacacac';
    const fallbackBase = setupChore(fallbackId);
    const probe = '.cursor/hooks/_smoke-review-hookless-fallback-probe.mjs';
    const probeAbs = join(root, probe);
    const transcriptsDir = mkdtempSync(join(smokeTmpRoot, 'review-hookless-tx-'));

    writeFileSync(probeAbs, 'export const smokeHooklessFallbackProbe = 1;\n');
    addIgnoredProbe(probe);
    const currentTask = run('track.mjs', {
      ...fallbackBase,
      hook_event_name: 'preToolUse',
      tool_name: 'Task',
      tool_input: {
        subagent_type: 'pre-commit-reviewer',
        description: 'review without child hook',
      },
    });
    const currentPrompt = currentTask.updated_input?.prompt;
    writeParentTranscript(transcriptsDir, currentPrompt, fallbackId);
    const currentPassPath = writeReviewerTranscript(
      transcriptsDir,
      'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
      'REVIEW: PASS',
      currentPrompt,
    );
    const currentPassCommit = runWithTranscripts(
      'gate.mjs',
      {
        ...fallbackBase,
        hook_event_name: 'beforeShellExecution',
        command: 'git commit -m test',
      },
      transcriptsDir,
    );
    assert(
      'hookless reviewer PASS uses current snapshot fallback',
      currentPassCommit.permission === 'allow' &&
        loadState(root, fallbackId).review.snapshotHash !== null &&
        loadState(root, fallbackId).review.reviewerTranscriptId ===
          'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee' &&
        loadState(root, fallbackId).review.binding === REVIEW_BINDING_BOUND &&
        existsSync(reviewPassUsedPath(currentPassPath)),
      JSON.stringify(currentPassCommit),
    );

    writeFileSync(probeAbs, 'export const smokeHooklessFallbackProbe = 1;\n');
    const capturedTask = run('track.mjs', {
      ...fallbackBase,
      hook_event_name: 'preToolUse',
      tool_name: 'Task',
      tool_input: {
        subagent_type: 'pre-commit-reviewer',
        description: 'review before edit without retry',
      },
    });
    const capturedPrompt = capturedTask.updated_input?.prompt;
    writeParentTranscript(transcriptsDir, capturedPrompt, fallbackId);
    const capturedPassPath = writeReviewerTranscript(
      transcriptsDir,
      '11111111-1111-4111-8111-111111111111',
      'REVIEW: PASS',
      capturedPrompt,
    );
    assert(
      'PASS remains unbound before stop or commit validation',
      loadState(root, fallbackId).review.reviewerTranscriptId == null &&
        loadState(root, fallbackId).review.binding === REVIEW_BINDING_UNBOUND,
      JSON.stringify(loadState(root, fallbackId).review),
    );
    writeFileSync(probeAbs, 'export const smokeHooklessFallbackProbe = 2;\n');
    run('track.mjs', {
      ...fallbackBase,
      hook_event_name: 'postToolUse',
      tool_name: 'Write',
      tool_input: { path: probeAbs },
    });
    const editedReview = loadState(root, fallbackId).review;
    const capturedStaleCommit = runWithTranscripts(
      'gate.mjs',
      {
        ...fallbackBase,
        hook_event_name: 'beforeShellExecution',
        command: 'git commit -m test',
      },
      transcriptsDir,
    );
    assert(
      'captured PASS cannot approve an edit without reviewer retry',
      capturedStaleCommit.permission === 'deny' &&
        editedReview.reviewerTranscriptId == null &&
        editedReview.binding === REVIEW_BINDING_UNBOUND &&
        !existsSync(reviewPassUsedPath(capturedPassPath)),
      JSON.stringify({ capturedStaleCommit, review: editedReview }),
    );

    writeFileSync(probeAbs, 'export const smokeHooklessFallbackProbe = 2;\n');
    const staleTask = run('track.mjs', {
      ...fallbackBase,
      hook_event_name: 'preToolUse',
      tool_name: 'Task',
      tool_input: {
        subagent_type: 'pre-commit-reviewer',
        description: 'review before stale PASS test',
      },
    });
    const stalePrompt = staleTask.updated_input?.prompt;
    writeParentTranscript(transcriptsDir, stalePrompt, fallbackId);
    const stalePassPath = writeReviewerTranscript(
      transcriptsDir,
      'ffffffff-ffff-4fff-8fff-ffffffffffff',
      'REVIEW: PASS',
      stalePrompt,
    );
    const oldTime = new Date(Date.now() - 5000);
    utimesSync(stalePassPath, oldTime, oldTime);
    writeFileSync(probeAbs, 'export const smokeHooklessFallbackProbe = 3;\n');
    run('track.mjs', {
      ...fallbackBase,
      hook_event_name: 'postToolUse',
      tool_name: 'Write',
      tool_input: { path: probeAbs },
    });
    const stalePassCommit = runWithTranscripts(
      'gate.mjs',
      {
        ...fallbackBase,
        hook_event_name: 'beforeShellExecution',
        command: 'git commit -m test',
      },
      transcriptsDir,
    );
    assert(
      'stale PASS cannot approve a changed snapshot',
      stalePassCommit.permission === 'deny' &&
        !existsSync(reviewPassUsedPath(stalePassPath)) &&
        loadState(root, fallbackId).review.snapshotHash !== null,
      JSON.stringify(stalePassCommit),
    );
    try {
      unlinkSync(probeAbs);
      resetIgnoredProbe(probe);
    } catch {
      // 無ければ無視
    }
  }

  // 一致候補が複数ある場合は、古い／別 fork の transcript を推測で選ばない
  {
    const ambiguousId = 'adadadad-adad-4dad-8dad-adadadadadad';
    const ambiguousBase = setupChore(ambiguousId);
    const probe = '.cursor/hooks/_smoke-review-ambiguous-prompt-probe.mjs';
    const probeAbs = join(root, probe);
    const transcriptsDir = mkdtempSync(join(smokeTmpRoot, 'review-ambiguous-tx-'));
    writeFileSync(probeAbs, 'export const smokeAmbiguousPromptProbe = 1;\n');
    addIgnoredProbe(probe);

    const task = run('track.mjs', {
      ...ambiguousBase,
      hook_event_name: 'preToolUse',
      tool_name: 'Task',
      tool_input: {
        subagent_type: 'pre-commit-reviewer',
        description: 'review ambiguous candidates',
      },
    });
    const prompt = task.updated_input?.prompt;
    writeParentTranscript(transcriptsDir, prompt, ambiguousId);
    const firstPath = writeReviewerTranscript(
      transcriptsDir,
      '12121212-1212-4121-8121-121212121212',
      'REVIEW: PASS',
      prompt,
    );
    const secondPath = writeReviewerTranscript(
      transcriptsDir,
      '13131313-1313-4131-8131-131313131313',
      'REVIEW: PASS',
      prompt,
    );
    const ambiguousCommit = runWithTranscripts(
      'gate.mjs',
      {
        ...ambiguousBase,
        hook_event_name: 'beforeShellExecution',
        command: 'git commit -m test',
      },
      transcriptsDir,
    );
    const ambiguousReview = loadState(root, ambiguousId).review;
    assert(
      'multiple matching PASS candidates deny without guessing',
      ambiguousCommit.permission === 'deny' &&
        ambiguousReview.reviewerTranscriptId == null &&
        !existsSync(reviewPassUsedPath(firstPath)) &&
        !existsSync(reviewPassUsedPath(secondPath)),
      JSON.stringify({ ambiguousCommit, review: ambiguousReview }),
    );
    try {
      unlinkSync(probeAbs);
      resetIgnoredProbe(probe);
    } catch {
      // 無ければ無視
    }
  }

  // 複数 fork の候補から、親 prompt に一致する child だけを採用する
  {
    const forkId = 'aeaeaeae-aeae-4eae-8eae-aeaeaeaeaeae';
    const forkBase = setupChore(forkId);
    const probe = '.cursor/hooks/_smoke-review-fork-probe.mjs';
    const probeAbs = join(root, probe);
    const transcriptsDir = mkdtempSync(join(smokeTmpRoot, 'review-fork-tx-'));
    writeFileSync(probeAbs, 'export const smokeForkProbe = 1;\n');
    addIgnoredProbe(probe);

    const task = run('track.mjs', {
      ...forkBase,
      hook_event_name: 'preToolUse',
      tool_name: 'Task',
      tool_input: {
        subagent_type: 'pre-commit-reviewer',
        description: 'review fork matching',
      },
    });
    const prompt = task.updated_input?.prompt;
    writeParentTranscript(transcriptsDir, prompt, forkId);
    const unrelatedPath = writeReviewerTranscript(
      transcriptsDir,
      '14141414-1414-4141-8141-141414141414',
      'REVIEW: PASS',
      `${prompt} from another fork`,
    );
    const matchingPath = writeReviewerTranscript(
      transcriptsDir,
      '15151515-1515-4151-8151-151515151515',
      'REVIEW: PASS',
      prompt.replace(/\s+/g, '  '),
    );
    const forkCommit = runWithTranscripts(
      'gate.mjs',
      {
        ...forkBase,
        hook_event_name: 'beforeShellExecution',
        command: 'git commit -m test',
      },
      transcriptsDir,
    );
    const forkReview = loadState(root, forkId).review;
    assert(
      'nonmatching fork PASS is ignored',
      forkCommit.permission === 'allow' &&
        forkReview.reviewerTranscriptId === '15151515-1515-4151-8151-151515151515' &&
        existsSync(reviewPassUsedPath(matchingPath)) &&
        !existsSync(reviewPassUsedPath(unrelatedPath)),
      JSON.stringify({ forkCommit, review: forkReview }),
    );
    try {
      unlinkSync(probeAbs);
      resetIgnoredProbe(probe);
    } catch {
      // 無ければ無視
    }
  }

  // runtime path が汚染されても、state の親 ID と prompt を正として binding する
  {
    const parentId = '16161616-1616-4161-8161-161616161616';
    const runtimeId = '17171717-1717-4171-8171-171717171717';
    const parentBase = setupChore(parentId);
    const probe = '.cursor/hooks/_smoke-review-state-parent-probe.mjs';
    const probeAbs = join(root, probe);
    const derivedHome = mkdtempSync(join(smokeTmpRoot, 'review-state-parent-home-'));
    const runtimeTranscriptsDir = mkdtempSync(join(smokeTmpRoot, 'review-state-parent-runtime-'));
    const previousHome = process.env.HOME;
    const previousOverride = process.env.CURSOR_GATE_TRANSCRIPTS_DIR;
    process.env.HOME = derivedHome;
    delete process.env.CURSOR_GATE_TRANSCRIPTS_DIR;
    const workspaceTranscriptsDir = agentTranscriptsDir(root);
    if (previousHome === undefined) delete process.env.HOME;
    else process.env.HOME = previousHome;
    if (previousOverride === undefined) delete process.env.CURSOR_GATE_TRANSCRIPTS_DIR;
    else process.env.CURSOR_GATE_TRANSCRIPTS_DIR = previousOverride;
    mkdirSync(workspaceTranscriptsDir, { recursive: true });
    writeFileSync(probeAbs, 'export const smokeStateParentProbe = 1;\n');
    addIgnoredProbe(probe);

    const task = run('track.mjs', {
      ...parentBase,
      hook_event_name: 'preToolUse',
      tool_name: 'Task',
      tool_input: {
        subagent_type: 'pre-commit-reviewer',
        description: 'review state parent precedence',
      },
    });
    const prompt = task.updated_input?.prompt;
    writeParentTranscript(runtimeTranscriptsDir, prompt, parentId);
    writeParentTranscript(runtimeTranscriptsDir, `${prompt} from another parent`, runtimeId);
    const passPath = writeReviewerTranscript(
      runtimeTranscriptsDir,
      '20202020-2020-4020-8020-202020202020',
      'REVIEW: PASS',
      prompt,
    );
    const parentCommit = run(
      'gate.mjs',
      {
        ...parentBase,
        hook_event_name: 'beforeShellExecution',
        command: 'git commit -m test',
      },
      {
        CURSOR_GATE_TRANSCRIPTS_DIR: '',
        CURSOR_TRANSCRIPT_PATH: transcriptPath(runtimeTranscriptsDir, runtimeId),
        HOME: derivedHome,
      },
    );
    const parentReview = loadState(root, parentId).review;
    assert(
      'state parent wins over polluted runtime path',
      parentCommit.permission === 'allow' &&
        parentReview.reviewerTranscriptId === '20202020-2020-4020-8020-202020202020' &&
        parentReview.binding === REVIEW_BINDING_BOUND &&
        existsSync(reviewPassUsedPath(passPath)),
      JSON.stringify({ parentCommit, review: parentReview }),
    );
    try {
      unlinkSync(probeAbs);
      resetIgnoredProbe(probe);
    } catch {
      // 無ければ無視
    }
    rmSync(derivedHome, { recursive: true, force: true });
    rmSync(runtimeTranscriptsDir, { recursive: true, force: true });
  }

  // sticky が無いイベントでは payload/env fallback を reviewer の親 identity に使わない
  {
    const noStickyId = '18181818-1818-4181-8181-181818181818';
    const noStickyBase = setupChore(noStickyId);
    const probe = '.cursor/hooks/_smoke-review-no-sticky-probe.mjs';
    const probeAbs = join(root, probe);
    const transcriptsDir = mkdtempSync(join(smokeTmpRoot, 'review-no-sticky-tx-'));
    writeFileSync(probeAbs, 'export const smokeNoStickyProbe = 1;\n');
    addIgnoredProbe(probe);
    clearSticky();

    const task = run('track.mjs', {
      ...noStickyBase,
      hook_event_name: 'preToolUse',
      tool_name: 'Task',
      tool_input: {
        subagent_type: 'pre-commit-reviewer',
        description: 'review without sticky parent identity',
      },
    });
    const prompt = task.updated_input?.prompt;
    writeParentTranscript(transcriptsDir, prompt, noStickyId);
    const passPath = writeReviewerTranscript(
      transcriptsDir,
      '19191919-1919-4191-8191-191919191919',
      'REVIEW: PASS',
      prompt,
    );
    const noStickyCommit = runWithTranscripts(
      'gate.mjs',
      {
        ...noStickyBase,
        transcript_path: transcriptPath(transcriptsDir, noStickyId),
        hook_event_name: 'beforeShellExecution',
        command: 'git commit -m test',
      },
      transcriptsDir,
    );
    const noStickyReview = loadState(root, noStickyId).review;
    assert(
      'missing sticky parent identity blocks reviewer binding',
      noStickyCommit.permission === 'deny' &&
        noStickyReview.reviewerTranscriptId == null &&
        noStickyReview.binding === REVIEW_BINDING_UNBOUND &&
        !existsSync(reviewPassUsedPath(passPath)),
      JSON.stringify({ noStickyCommit, review: noStickyReview }),
    );
    try {
      unlinkSync(probeAbs);
      resetIgnoredProbe(probe);
    } catch {
      // 無ければ無視
    }
  }

  // resume で過去の prompt が残っていても、PASS直前の最新 prompt で binding する
  {
    const resumedId = '1a1a1a1a-1a1a-41a1-81a1-1a1a1a1a1a1a';
    const resumedBase = setupChore(resumedId);
    const probe = '.cursor/hooks/_smoke-review-resumed-probe.mjs';
    const probeAbs = join(root, probe);
    const transcriptsDir = mkdtempSync(join(smokeTmpRoot, 'review-resumed-tx-'));
    writeFileSync(probeAbs, 'export const smokeResumedProbe = 1;\n');
    addIgnoredProbe(probe);

    const task = run('track.mjs', {
      ...resumedBase,
      hook_event_name: 'preToolUse',
      tool_name: 'Task',
      tool_input: {
        subagent_type: 'pre-commit-reviewer',
        description: 'review resumed transcript',
      },
    });
    const prompt = task.updated_input?.prompt;
    const previousPrompt = `${prompt} from the initial invocation`;
    writeParentTranscript(transcriptsDir, prompt, resumedId);
    const passPath = writeReviewerTranscript(
      transcriptsDir,
      '1b1b1b1b-1b1b-41b1-81b1-1b1b1b1b1b1b',
      'REVIEW: PASS',
      prompt,
      previousPrompt,
    );
    const resumedCommit = runWithTranscripts(
      'gate.mjs',
      {
        ...resumedBase,
        hook_event_name: 'beforeShellExecution',
        command: 'git commit -m test',
      },
      transcriptsDir,
    );
    const resumedReview = loadState(root, resumedId).review;
    assert(
      'resumed reviewer uses the latest prompt before PASS',
      resumedCommit.permission === 'allow' &&
        resumedReview.reviewerTranscriptId === '1b1b1b1b-1b1b-41b1-81b1-1b1b1b1b1b1b' &&
        resumedReview.binding === REVIEW_BINDING_BOUND &&
        existsSync(reviewPassUsedPath(passPath)),
      JSON.stringify({ resumedCommit, review: resumedReview }),
    );
    try {
      unlinkSync(probeAbs);
      resetIgnoredProbe(probe);
    } catch {
      // 無ければ無視
    }
  }

  // legacy review.files state は snapshot 未取得として再レビューを要求する
  {
    const legacyProbe = '.cursor/hooks/_smoke-review-legacy-state-probe.mjs';
    const legacyProbeAbs = join(root, legacyProbe);
    writeFileSync(legacyProbeAbs, 'export const smokeLegacyReviewProbe = 1;\n');
    addIgnoredProbe(legacyProbe);
    run('track.mjs', {
      ...base,
      hook_event_name: 'beforeSubmitPrompt',
      prompt: '/scope ok',
    });
    run('track.mjs', {
      ...base,
      hook_event_name: 'beforeSubmitPrompt',
      prompt: '/chore legacy review state',
    });
    const legacyState = JSON.parse(readFileSync(stateAbs(), 'utf8'));
    const legacyTranscriptId = '99999999-9999-4999-8999-999999999999';
    legacyState.review = {
      files: [legacyProbe],
      dirtyAt: '2026-01-01T00:00:00+09:00',
      reviewerTranscriptPath: join(smokeTmpRoot, legacyTranscriptId, `${legacyTranscriptId}.jsonl`),
    };
    writeFileSync(stateAbs(), `${JSON.stringify(legacyState, null, 2)}\n`);
    const migratedLegacy = loadState(root, id);
    assert(
      'legacy reviewer path migrates to ID without persisting the path',
      migratedLegacy.review.reviewerTranscriptId === legacyTranscriptId &&
        !Object.hasOwn(migratedLegacy.review, 'reviewerTranscriptPath'),
      JSON.stringify(migratedLegacy.review),
    );

    const legacyCommit = run('gate.mjs', {
      ...base,
      hook_event_name: 'beforeShellExecution',
      command: 'git commit -m test',
    });
    const normalizedLegacy = loadState(root, id);
    assert(
      'legacy review.files state requires a new snapshot review',
      legacyCommit.permission === 'deny' &&
        typeof normalizedLegacy.review.snapshotHash === 'string' &&
        normalizedLegacy.review.snapshotHash.startsWith('sha256:') &&
        !Object.hasOwn(normalizedLegacy.review, 'files') &&
        !Object.hasOwn(normalizedLegacy.review, 'dirtyAt'),
      JSON.stringify({ legacyCommit, review: normalizedLegacy.review }),
    );
    try {
      unlinkSync(legacyProbeAbs);
      resetIgnoredProbe(legacyProbe);
    } catch {
      // 無ければ無視
    }
  }

  // stop も current snapshot が一致するときだけ PASS を消費する
  {
    const stopId = 'afafafaf-afaf-4faf-8faf-afafafafafaf';
    const stopBase = setupChore(stopId);
    const probe = '.cursor/hooks/_smoke-review-stop-snapshot-probe.mjs';
    const probeAbs = join(root, probe);
    const transcriptsDir = mkdtempSync(join(smokeTmpRoot, 'review-stop-tx-'));
    writeFileSync(probeAbs, 'export const smokeReviewStopProbe = 1;\n');
    addIgnoredProbe(probe);
    const task = run('track.mjs', {
      ...stopBase,
      hook_event_name: 'preToolUse',
      tool_name: 'Task',
      tool_input: {
        subagent_type: 'pre-commit-reviewer',
        description: 'review before stop',
      },
    });
    const prompt = task.updated_input?.prompt;
    writeParentTranscript(transcriptsDir, prompt, stopId);
    const childPath = writeReviewerTranscript(
      transcriptsDir,
      'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      'REVIEW: PASS',
      prompt,
    );
    runWithTranscripts(
      'track.mjs',
      {
        ...stopBase,
        hook_event_name: 'stop',
        status: 'completed',
      },
      transcriptsDir,
    );
    const stopped = loadState(root, stopId);
    assert(
      'stop binds matching snapshot PASS',
      stopped.review.snapshotHash !== null &&
        stopped.review.snapshotAt !== null &&
        stopped.review.reviewerTranscriptId === 'dddddddd-dddd-4ddd-8ddd-dddddddddddd' &&
        stopped.review.binding === REVIEW_BINDING_BOUND,
      JSON.stringify(stopped.review),
    );
    assert('stop marks matching PASS used', existsSync(reviewPassUsedPath(childPath)));
    try {
      unlinkSync(probeAbs);
      resetIgnoredProbe(probe);
    } catch {
      // 無ければ無視
    }
  }
}

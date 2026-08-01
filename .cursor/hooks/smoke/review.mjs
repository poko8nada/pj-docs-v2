/** smoke: review */
import { execFileSync } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';
import { reviewPassUsedPath } from '../lib/review.mjs';

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

  function writeReviewerTranscript(dir, transcriptId, verdict) {
    const childDir = join(dir, transcriptId);
    mkdirSync(childDir, { recursive: true });
    const path = join(childDir, `${transcriptId}.jsonl`);
    writeFileSync(
      path,
      `${JSON.stringify({
        role: 'user',
        message: {
          content: [
            {
              type: 'text',
              text: `Full Repository Path: ${resolve(root)}\nDiff: current Git snapshot\n`,
            },
          ],
        },
      })}\n${JSON.stringify({
        role: 'assistant',
        message: { content: [{ type: 'text', text: `${verdict}\n` }] },
      })}\n`,
    );
    return path;
  }

  function captureReviewer(conversationBase, childPath, transcriptsDir) {
    const parentId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const parentPath = join(transcriptsDir, parentId, `${parentId}.jsonl`);
    mkdirSync(join(transcriptsDir, parentId), { recursive: true });
    return run(
      'track.mjs',
      {
        ...conversationBase,
        hook_event_name: 'postToolUse',
        tool_name: 'Task',
        transcript_path: childPath,
      },
      { CURSOR_TRANSCRIPT_PATH: parentPath },
    );
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
    const reviewId = 'review-snapshot-gate-id';
    const reviewBase = setupChore(reviewId);
    const probe = '.cursor/hooks/_smoke-review-snapshot-probe.mjs';
    const probeAbs = join(root, probe);
    const deletionAnchor = '.cursor/hooks/_smoke-review-deletion-anchor.mjs';
    const deletionAnchorAbs = join(root, deletionAnchor);
    const transcriptsDir = mkdtempSync(join(smokeTmpRoot, 'review-snapshot-tx-'));
    const runWithTranscripts = (script, payload) =>
      run(script, payload, { CURSOR_GATE_TRANSCRIPTS_DIR: transcriptsDir });
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

    const beforeTask = runWithTranscripts('gate.mjs', {
      ...reviewBase,
      hook_event_name: 'beforeShellExecution',
      command: 'git commit -m test',
    });
    assert(
      'commit denies before reviewer PASS',
      beforeTask.permission === 'deny' &&
        String(beforeTask.agent_message ?? '').includes('No reviewer child transcript ID') &&
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
        afterTask.review.reviewerTranscriptId == null,
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
    const changed = runWithTranscripts('gate.mjs', {
      ...reviewBase,
      hook_event_name: 'beforeShellExecution',
      command: 'git commit -m test',
    });
    const reboundState = loadState(root, reviewId);
    assert(
      'commit denies when current snapshot changes',
      changed.permission === 'deny' && reboundState.review.snapshotHash === changedSnapshot.hash,
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
    const gapsId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
    const gapsPath = writeReviewerTranscript(transcriptsDir, gapsId, 'REVIEW: GAPS');
    captureReviewer(reviewBase, gapsPath, transcriptsDir);
    assert(
      'GAPS child ID is captured without storing its path',
      loadState(root, reviewId).review.reviewerTranscriptId === gapsId &&
        !JSON.stringify(loadState(root, reviewId).review).includes(transcriptsDir),
      JSON.stringify(loadState(root, reviewId).review),
    );
    const gapsCommit = runWithTranscripts('gate.mjs', {
      ...reviewBase,
      hook_event_name: 'beforeShellExecution',
      command: 'git commit -m test',
    });
    assert('GAPS child still blocks commit', gapsCommit.permission === 'deny');

    const passId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
    const passPath = writeReviewerTranscript(transcriptsDir, passId, 'REVIEW: PASS');
    captureReviewer(reviewBase, passPath, transcriptsDir);
    const passCommit = runWithTranscripts('gate.mjs', {
      ...reviewBase,
      hook_event_name: 'beforeShellExecution',
      command: 'git commit -m test',
    });
    const cleared = loadState(root, reviewId);
    assert(
      'PASS for current snapshot clears commit gate',
      passCommit.permission === 'allow' &&
        cleared.review.snapshotHash == null &&
        cleared.review.snapshotAt == null &&
        cleared.review.reviewerTranscriptId == null,
      JSON.stringify({ passCommit, review: cleared.review }),
    );
    assert('PASS transcript is marked used', existsSync(reviewPassUsedPath(passPath)));

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
    const deleteCommit = runWithTranscripts('gate.mjs', {
      ...reviewBase,
      hook_event_name: 'beforeShellExecution',
      command: 'git commit -m test',
    });
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
    const fallbackId = 'review-hookless-fallback-id';
    const fallbackBase = setupChore(fallbackId);
    const probe = '.cursor/hooks/_smoke-review-hookless-fallback-probe.mjs';
    const probeAbs = join(root, probe);
    const transcriptsDir = mkdtempSync(join(smokeTmpRoot, 'review-hookless-tx-'));
    const runWithTranscripts = (script, payload) =>
      run(script, payload, { CURSOR_GATE_TRANSCRIPTS_DIR: transcriptsDir });

    writeFileSync(probeAbs, 'export const smokeHooklessFallbackProbe = 1;\n');
    addIgnoredProbe(probe);
    run('track.mjs', {
      ...fallbackBase,
      hook_event_name: 'preToolUse',
      tool_name: 'Task',
      tool_input: {
        subagent_type: 'pre-commit-reviewer',
        description: 'review without child hook',
      },
    });
    const currentPassPath = writeReviewerTranscript(
      transcriptsDir,
      'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
      'REVIEW: PASS',
    );
    const currentPassCommit = runWithTranscripts('gate.mjs', {
      ...fallbackBase,
      hook_event_name: 'beforeShellExecution',
      command: 'git commit -m test',
    });
    assert(
      'hookless reviewer PASS uses current snapshot fallback',
      currentPassCommit.permission === 'allow' &&
        loadState(root, fallbackId).review.snapshotHash == null &&
        existsSync(reviewPassUsedPath(currentPassPath)),
      JSON.stringify(currentPassCommit),
    );

    writeFileSync(probeAbs, 'export const smokeHooklessFallbackProbe = 1;\n');
    run('track.mjs', {
      ...fallbackBase,
      hook_event_name: 'preToolUse',
      tool_name: 'Task',
      tool_input: {
        subagent_type: 'pre-commit-reviewer',
        description: 'review before edit without retry',
      },
    });
    const capturedPassPath = writeReviewerTranscript(
      transcriptsDir,
      '11111111-1111-4111-8111-111111111111',
      'REVIEW: PASS',
    );
    captureReviewer(fallbackBase, capturedPassPath, transcriptsDir);
    assert(
      'captured PASS is bound before edit',
      loadState(root, fallbackId).review.reviewerTranscriptId ===
        '11111111-1111-4111-8111-111111111111',
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
    const capturedStaleCommit = runWithTranscripts('gate.mjs', {
      ...fallbackBase,
      hook_event_name: 'beforeShellExecution',
      command: 'git commit -m test',
    });
    assert(
      'captured PASS cannot approve an edit without reviewer retry',
      capturedStaleCommit.permission === 'deny' &&
        editedReview.reviewerTranscriptId == null &&
        !existsSync(reviewPassUsedPath(capturedPassPath)),
      JSON.stringify({ capturedStaleCommit, review: editedReview }),
    );

    writeFileSync(probeAbs, 'export const smokeHooklessFallbackProbe = 2;\n');
    run('track.mjs', {
      ...fallbackBase,
      hook_event_name: 'preToolUse',
      tool_name: 'Task',
      tool_input: {
        subagent_type: 'pre-commit-reviewer',
        description: 'review before stale PASS test',
      },
    });
    const stalePassPath = writeReviewerTranscript(
      transcriptsDir,
      'ffffffff-ffff-4fff-8fff-ffffffffffff',
      'REVIEW: PASS',
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
    const stalePassCommit = runWithTranscripts('gate.mjs', {
      ...fallbackBase,
      hook_event_name: 'beforeShellExecution',
      command: 'git commit -m test',
    });
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

  // legacy review.files state は snapshot 未取得として再レビューを要求する
  {
    const legacyProbe = '.cursor/hooks/_smoke-review-legacy-state-probe.mjs';
    const legacyProbeAbs = join(root, legacyProbe);
    writeFileSync(legacyProbeAbs, 'export const smokeLegacyReviewProbe = 1;\n');
    addIgnoredProbe(legacyProbe);
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
    const stopId = 'review-stop-snapshot-id';
    const stopBase = setupChore(stopId);
    const probe = '.cursor/hooks/_smoke-review-stop-snapshot-probe.mjs';
    const probeAbs = join(root, probe);
    const transcriptsDir = mkdtempSync(join(smokeTmpRoot, 'review-stop-tx-'));
    const runWithTranscripts = (script, payload) =>
      run(script, payload, { CURSOR_GATE_TRANSCRIPTS_DIR: transcriptsDir });
    writeFileSync(probeAbs, 'export const smokeReviewStopProbe = 1;\n');
    addIgnoredProbe(probe);
    run('track.mjs', {
      ...stopBase,
      hook_event_name: 'preToolUse',
      tool_name: 'Task',
      tool_input: {
        subagent_type: 'pre-commit-reviewer',
        description: 'review before stop',
      },
    });
    const childPath = writeReviewerTranscript(
      transcriptsDir,
      'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      'REVIEW: PASS',
    );
    captureReviewer(stopBase, childPath, transcriptsDir);
    runWithTranscripts('track.mjs', {
      ...stopBase,
      hook_event_name: 'stop',
      status: 'completed',
    });
    const stopped = loadState(root, stopId);
    assert(
      'stop clears matching snapshot PASS',
      stopped.review.snapshotHash == null &&
        stopped.review.snapshotAt == null &&
        stopped.review.reviewerTranscriptId == null,
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

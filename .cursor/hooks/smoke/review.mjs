/** smoke: review */
import { existsSync, utimesSync } from 'node:fs';
import { reviewPassUsedPath } from '../lib/review.mjs';

/** @param {import('./_harness.mjs').SmokeCtx} smoke */
export function runReviewGate(smoke) {
  // review gate
  const {
    root,
    run,
    assert,
    trackReadTsRef,
    loadState,
    buildReviewTaskInjection,
    collectReviewDiff,
    unlinkSync,
    writeFileSync,
    mkdirSync,
    mkdtempSync,
    smokeTmpRoot,
    resolve,
    join,
  } = smoke;
  // review: dirty → commit deny → Task inject（clear しない）→ PASS で clear → re-edit
  {
    const reviewId = 'review-gate-id';
    const reviewBase = { conversation_id: reviewId, workspace_roots: [root], cwd: root };
    run('track.mjs', {
      ...reviewBase,
      hook_event_name: 'beforeSubmitPrompt',
      prompt: '/chore review test',
    });
    run('track.mjs', {
      ...reviewBase,
      hook_event_name: 'preToolUse',
      tool_name: 'ReadFile',
      tool_input: { path: join(root, '.cursor/skills/scope/SKILL.md') },
    });
    run('track.mjs', {
      ...reviewBase,
      hook_event_name: 'preToolUse',
      tool_name: 'ReadFile',
      tool_input: { path: join(root, '.cursor/skills/rules/SKILL.md') },
    });
    writeFileSync(
      join(root, '.cursor/hooks/_smoke-review-probe.mjs'),
      'export const smokeReviewProbe = 1;\n',
    );
    trackReadTsRef(reviewBase);
    run('track.mjs', {
      ...reviewBase,
      hook_event_name: 'postToolUse',
      tool_name: 'Write',
      tool_input: { path: join(root, '.cursor/hooks/_smoke-review-probe.mjs') },
    });
    const stDirty = loadState(root, reviewId);
    assert(
      'review files after edits',
      Array.isArray(stDirty.review?.files) &&
        stDirty.review.files.includes('.cursor/hooks/_smoke-review-probe.mjs'),
      JSON.stringify(stDirty),
    );
    assert(
      'dirtyAt set after edits',
      typeof stDirty.review?.dirtyAt === 'string' && stDirty.review.dirtyAt.includes('+09:00'),
      JSON.stringify(stDirty.review),
    );

    const denyCommit = run('gate.mjs', {
      ...reviewBase,
      hook_event_name: 'beforeShellExecution',
      command: 'git commit -m test',
    });
    assert(
      'review blocks git commit',
      denyCommit.permission === 'deny',
      JSON.stringify(denyCommit),
    );

    const injectOut = run('track.mjs', {
      ...reviewBase,
      hook_event_name: 'preToolUse',
      tool_name: 'Task',
      tool_input: { subagent_type: 'pre-commit-reviewer', description: 'review before commit' },
    });
    const injected = String(injectOut.updated_input?.description ?? '');
    const injectedTask = String(injectOut.updated_input?.task ?? '');
    assert(
      'preToolUse Task injects review.files into prompt',
      injectOut.permission === 'allow' &&
        injected.includes('[harness-review]') &&
        injected.includes('.cursor/hooks/_smoke-review-probe.mjs') &&
        injected.includes('smokeReviewProbe') &&
        injected.includes('Do not run git') &&
        injectedTask.includes('[harness-review]'),
      JSON.stringify(injectOut),
    );
    try {
      unlinkSync(join(root, '.cursor/hooks/_smoke-review-probe.mjs'));
    } catch {
      // 無ければ無視
    }

    const newProbe = '.cursor/hooks/_smoke-review-new-probe.mjs';
    const newAbs = join(root, newProbe);
    writeFileSync(newAbs, 'export const smokeReviewNewProbe = 1;\n');
    try {
      const got = collectReviewDiff(root, newProbe);
      assert(
        'untracked probe yields kind new',
        got.kind === 'new' && got.body.includes('smokeReviewNewProbe'),
        JSON.stringify(got),
      );
      const block = buildReviewTaskInjection(root, [newProbe]);
      assert(
        'injection includes fence for new probe',
        Boolean(block) &&
          block.includes('```') &&
          block.includes('smokeReviewNewProbe') &&
          block.includes(newProbe),
        String(block).slice(0, 500),
      );
    } finally {
      try {
        unlinkSync(newAbs);
      } catch {
        // 無ければ無視
      }
    }
    const stAfterInject = loadState(root, reviewId);
    assert(
      'preToolUse Task injects without clearing review.files',
      Array.isArray(stAfterInject.review?.files) &&
        stAfterInject.review.files.includes('.cursor/hooks/_smoke-review-probe.mjs') &&
        typeof stAfterInject.review.dirtyAt === 'string',
      JSON.stringify(stAfterInject),
    );

    const transcriptsDir = mkdtempSync(join(smokeTmpRoot, 'review-gate-tx-'));
    const childId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    mkdirSync(join(transcriptsDir, childId), { recursive: true });
    const gatePrompt = `Full Repository Path: ${resolve(root)}\nDiff: uncommitted changes\n`;
    writeFileSync(
      join(transcriptsDir, childId, `${childId}.jsonl`),
      `${JSON.stringify({
        role: 'user',
        message: {
          content: [{ type: 'text', text: gatePrompt }],
        },
      })}\n${JSON.stringify({
        role: 'assistant',
        message: {
          content: [{ type: 'text', text: 'REVIEW: PASS\n' }],
        },
      })}\n`,
    );

    const allowCommit = run(
      'gate.mjs',
      {
        ...reviewBase,
        hook_event_name: 'beforeShellExecution',
        command: 'git commit -m test',
      },
      { CURSOR_GATE_TRANSCRIPTS_DIR: transcriptsDir },
    );
    const stReviewed = loadState(root, reviewId);
    const gatePassJsonl = join(transcriptsDir, childId, `${childId}.jsonl`);
    assert(
      'PASS transcript after Task allows commit and clears files',
      allowCommit.permission === 'allow' &&
        Array.isArray(stReviewed.review?.files) &&
        stReviewed.review.files.length === 0 &&
        stReviewed.review.dirtyAt == null,
      JSON.stringify({ allowCommit, review: stReviewed.review }),
    );
    assert(
      'Task PASS clear marks harness-pass-used',
      existsSync(reviewPassUsedPath(gatePassJsonl)),
      reviewPassUsedPath(gatePassJsonl),
    );

    run('track.mjs', {
      ...reviewBase,
      hook_event_name: 'beforeShellExecution',
      command: 'git commit -m test',
    });
    const stStillClear = loadState(root, reviewId);
    assert(
      'beforeShell commit attempt does not refill files',
      Array.isArray(stStillClear.review?.files) && stStillClear.review.files.length === 0,
      JSON.stringify(stStillClear),
    );

    run('track.mjs', {
      ...reviewBase,
      hook_event_name: 'afterShellExecution',
      command: 'git commit -m test',
      exit_code: 0,
    });
    const stAfter = loadState(root, reviewId);
    assert(
      'successful commit keeps review.files empty',
      Array.isArray(stAfter.review?.files) && stAfter.review.files.length === 0,
      JSON.stringify(stAfter),
    );

    run('track.mjs', {
      ...reviewBase,
      hook_event_name: 'afterShellExecution',
      command: 'git add .cursor/hooks/_missed-by-write.mjs .cursor/hooks/_smoke-from-add.ts',
      exit_code: 0,
    });
    const stAdd = loadState(root, reviewId);
    assert(
      'git add does not change review state',
      Array.isArray(stAdd.review?.files) && stAdd.review.files.length === 0,
      JSON.stringify(stAdd),
    );

    run('track.mjs', {
      ...reviewBase,
      hook_event_name: 'postToolUse',
      tool_name: 'Write',
      tool_input: { path: join(root, 'docs/_not-reviewable.md') },
    });
    run('track.mjs', {
      ...reviewBase,
      hook_event_name: 'postToolUse',
      tool_name: 'Write',
      tool_input: { path: join(root, 'package-lock-probe.json') },
    });
    const stDocs = loadState(root, reviewId);
    assert(
      'md/json edits do not enter review.files',
      Array.isArray(stDocs.review?.files) && stDocs.review.files.length === 0,
      JSON.stringify(stDocs),
    );

    run('track.mjs', {
      ...reviewBase,
      hook_event_name: 'postToolUse',
      tool_name: 'Write',
      tool_input: { path: join(root, '.cursor/hooks/_smoke-review-probe.mjs') },
    });
    const stRedirty = loadState(root, reviewId);
    assert(
      're-edit refills review.files',
      Array.isArray(stRedirty.review?.files) &&
        stRedirty.review.files.includes('.cursor/hooks/_smoke-review-probe.mjs'),
      JSON.stringify(stRedirty),
    );

    const denyAfterAddCommit = run('gate.mjs', {
      ...reviewBase,
      hook_event_name: 'beforeShellExecution',
      command: 'git add .cursor/hooks/_smoke-review-probe.mjs && git commit -m test',
    });
    assert(
      'add&&commit still blocked while files non-empty',
      denyAfterAddCommit.permission === 'deny' &&
        String(denyAfterAddCommit.agent_message ?? denyAfterAddCommit.user_message ?? '').includes(
          '.cursor/hooks/_smoke-review-probe.mjs',
        ),
      JSON.stringify(denyAfterAddCommit),
    );
  }

  // commit 時: dirtyAt 以降の子 transcript に REVIEW: PASS → clear
  {
    const { saveState } = smoke;
    const passId = 'review-pass-scan-id';
    const passBase = { conversation_id: passId, workspace_roots: [root], cwd: root };
    const transcriptsDir = mkdtempSync(join(smokeTmpRoot, 'transcripts-'));
    const childId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
    const childDir = join(transcriptsDir, childId);
    mkdirSync(childDir, { recursive: true });

    function writeChildJsonl(verdictText, promptText) {
      writeFileSync(
        join(childDir, `${childId}.jsonl`),
        `${JSON.stringify({
          role: 'user',
          message: { content: [{ type: 'text', text: promptText }] },
        })}\n${JSON.stringify({
          role: 'assistant',
          message: { content: [{ type: 'text', text: verdictText }] },
        })}\n`,
      );
    }

    const goodPrompt = () => `Full Repository Path: ${resolve(root)}\nDiff: uncommitted changes\n`;

    run('track.mjs', {
      ...passBase,
      hook_event_name: 'beforeSubmitPrompt',
      prompt: '/chore review pass scan',
    });
    run('track.mjs', {
      ...passBase,
      hook_event_name: 'preToolUse',
      tool_name: 'ReadFile',
      tool_input: { path: join(root, '.cursor/skills/scope/SKILL.md') },
    });
    run('track.mjs', {
      ...passBase,
      hook_event_name: 'preToolUse',
      tool_name: 'ReadFile',
      tool_input: { path: join(root, '.cursor/skills/rules/SKILL.md') },
    });
    trackReadTsRef(passBase);
    writeFileSync(
      join(root, '.cursor/hooks/_smoke-review-pass-probe.mjs'),
      'export const smokeReviewPassProbe = 1;\n',
    );
    run('track.mjs', {
      ...passBase,
      hook_event_name: 'postToolUse',
      tool_name: 'Write',
      tool_input: { path: join(root, '.cursor/hooks/_smoke-review-pass-probe.mjs') },
    });
    const stDirty = loadState(root, passId);
    assert(
      'pass-scan dirty before transcript',
      stDirty.review.files.includes('.cursor/hooks/_smoke-review-pass-probe.mjs') &&
        typeof stDirty.review.dirtyAt === 'string',
      JSON.stringify(stDirty.review),
    );

    const stillDeny = run(
      'gate.mjs',
      {
        ...passBase,
        hook_event_name: 'beforeShellExecution',
        command: 'git commit -m test',
      },
      { CURSOR_GATE_TRANSCRIPTS_DIR: transcriptsDir },
    );
    assert(
      'commit still denied without PASS transcript',
      stillDeny.permission === 'deny',
      JSON.stringify(stillDeny),
    );

    writeChildJsonl('Looks bad.\n\nREVIEW: GAPS\n', goodPrompt());
    const afterGaps = run(
      'gate.mjs',
      {
        ...passBase,
        hook_event_name: 'beforeShellExecution',
        command: 'git commit -m test',
      },
      { CURSOR_GATE_TRANSCRIPTS_DIR: transcriptsDir },
    );
    assert(
      'GAPS transcript does not clear review',
      afterGaps.permission === 'deny' &&
        loadState(root, passId).review.files.includes('.cursor/hooks/_smoke-review-pass-probe.mjs'),
      JSON.stringify(afterGaps),
    );

    writeChildJsonl('REVIEW: PASS\n', `Full Repository Path:\nDiff: uncommitted changes\n`);
    const afterHeaderOnly = run(
      'gate.mjs',
      {
        ...passBase,
        hook_event_name: 'beforeShellExecution',
        command: 'git commit -m test',
      },
      { CURSOR_GATE_TRANSCRIPTS_DIR: transcriptsDir },
    );
    assert(
      'PASS without workspace root does not clear',
      afterHeaderOnly.permission === 'deny' &&
        loadState(root, passId).review.files.includes('.cursor/hooks/_smoke-review-pass-probe.mjs'),
      JSON.stringify(afterHeaderOnly),
    );

    writeChildJsonl(
      'REVIEW: PASS\n',
      `Just chatting about ${resolve(root)} with no reviewer prompt\n`,
    );
    const afterNoSig = run(
      'gate.mjs',
      {
        ...passBase,
        hook_event_name: 'beforeShellExecution',
        command: 'git commit -m test',
      },
      { CURSOR_GATE_TRANSCRIPTS_DIR: transcriptsDir },
    );
    assert(
      'PASS without reviewer signature does not clear',
      afterNoSig.permission === 'deny' &&
        loadState(root, passId).review.files.includes('.cursor/hooks/_smoke-review-pass-probe.mjs'),
      JSON.stringify(afterNoSig),
    );

    // dirtyAt より後の mtime になるよう、dirty 後に PASS transcript を書く
    writeChildJsonl('Looks good.\n\nREVIEW: PASS\n', goodPrompt());

    const afterPass = run(
      'gate.mjs',
      {
        ...passBase,
        hook_event_name: 'beforeShellExecution',
        command: 'git commit -m test',
      },
      { CURSOR_GATE_TRANSCRIPTS_DIR: transcriptsDir },
    );
    const stCleared = loadState(root, passId);
    const passJsonlPath = join(childDir, `${childId}.jsonl`);
    assert(
      'PASS transcript clears review and allows commit',
      afterPass.permission === 'allow' &&
        Array.isArray(stCleared.review?.files) &&
        stCleared.review.files.length === 0 &&
        stCleared.review.dirtyAt == null,
      JSON.stringify({ afterPass, review: stCleared.review }),
    );
    assert(
      'PASS clear writes harness-pass-used flag',
      existsSync(reviewPassUsedPath(passJsonlPath)),
      reviewPassUsedPath(passJsonlPath),
    );

    // used 付き PASS は再利用できない
    saveState(root, passId, {
      phase: 'chore',
      review: { files: ['.cursor/hooks/_smoke-review-pass-probe.mjs'], dirtyAt: null },
    });
    const reuseDeny = run(
      'gate.mjs',
      {
        ...passBase,
        hook_event_name: 'beforeShellExecution',
        command: 'git commit -m test',
      },
      { CURSOR_GATE_TRANSCRIPTS_DIR: transcriptsDir },
    );
    assert(
      'used PASS does not clear again',
      reuseDeny.permission === 'deny' &&
        loadState(root, passId).review.files.includes('.cursor/hooks/_smoke-review-pass-probe.mjs'),
      JSON.stringify(reuseDeny),
    );

    // dirtyAt null = カットオフなし（unused PASS があれば clear できる）
    unlinkSync(reviewPassUsedPath(passJsonlPath));
    saveState(root, passId, {
      phase: 'chore',
      review: { files: ['.cursor/hooks/_smoke-review-pass-probe.mjs'], dirtyAt: null },
    });
    writeChildJsonl('REVIEW: PASS\n', goodPrompt());
    const afterNullDirty = run(
      'gate.mjs',
      {
        ...passBase,
        hook_event_name: 'beforeShellExecution',
        command: 'git commit -m test',
      },
      { CURSOR_GATE_TRANSCRIPTS_DIR: transcriptsDir },
    );
    assert(
      'null dirtyAt still clears on PASS',
      afterNullDirty.permission === 'allow' && loadState(root, passId).review.files.length === 0,
      JSON.stringify({ afterNullDirty, review: loadState(root, passId).review }),
    );

    // 古い PASS 子 + 新しい GAPS 子 → 最新 mtime の verdict を採用し deny
    saveState(root, passId, {
      phase: 'chore',
      review: {
        files: ['.cursor/hooks/_smoke-review-pass-probe.mjs'],
        dirtyAt: '2026-01-01T00:00:00+09:00',
      },
    });
    // 直前の PASS jsonl が最新 mtime のまま残ると誤って clear されるので隔離
    const multiDir = mkdtempSync(join(smokeTmpRoot, 'transcripts-multi-'));
    const olderId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
    const newerId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
    mkdirSync(join(multiDir, olderId), { recursive: true });
    mkdirSync(join(multiDir, newerId), { recursive: true });
    const olderPath = join(multiDir, olderId, `${olderId}.jsonl`);
    const newerPath = join(multiDir, newerId, `${newerId}.jsonl`);
    writeFileSync(
      olderPath,
      `${JSON.stringify({
        role: 'user',
        message: { content: [{ type: 'text', text: goodPrompt() }] },
      })}\n${JSON.stringify({
        role: 'assistant',
        message: { content: [{ type: 'text', text: 'REVIEW: PASS\n' }] },
      })}\n`,
    );
    writeFileSync(
      newerPath,
      `${JSON.stringify({
        role: 'user',
        message: { content: [{ type: 'text', text: goodPrompt() }] },
      })}\n${JSON.stringify({
        role: 'assistant',
        message: { content: [{ type: 'text', text: 'REVIEW: GAPS\n' }] },
      })}\n`,
    );
    const olderSec = Math.floor(Date.now() / 1000) - 60;
    const newerSec = Math.floor(Date.now() / 1000);
    utimesSync(olderPath, olderSec, olderSec);
    utimesSync(newerPath, newerSec, newerSec);

    const afterNewerGaps = run(
      'gate.mjs',
      {
        ...passBase,
        hook_event_name: 'beforeShellExecution',
        command: 'git commit -m test',
      },
      { CURSOR_GATE_TRANSCRIPTS_DIR: multiDir },
    );
    assert(
      'newer GAPS wins over older PASS',
      afterNewerGaps.permission === 'deny' &&
        loadState(root, passId).review.files.includes('.cursor/hooks/_smoke-review-pass-probe.mjs'),
      JSON.stringify(afterNewerGaps),
    );

    try {
      unlinkSync(join(root, '.cursor/hooks/_smoke-review-pass-probe.mjs'));
    } catch {
      // 無ければ無視
    }
  }

  // stop: unused PASS → clear + used（commit 前にターン終了する想定）
  {
    const stopId = 'review-stop-clear-id';
    const stopBase = { conversation_id: stopId, workspace_roots: [root], cwd: root };
    const transcriptsDir = mkdtempSync(join(smokeTmpRoot, 'transcripts-stop-'));
    const childId = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
    mkdirSync(join(transcriptsDir, childId), { recursive: true });

    run('track.mjs', {
      ...stopBase,
      hook_event_name: 'beforeSubmitPrompt',
      prompt: '/chore review stop clear',
    });
    run('track.mjs', {
      ...stopBase,
      hook_event_name: 'preToolUse',
      tool_name: 'ReadFile',
      tool_input: { path: join(root, '.cursor/skills/scope/SKILL.md') },
    });
    run('track.mjs', {
      ...stopBase,
      hook_event_name: 'preToolUse',
      tool_name: 'ReadFile',
      tool_input: { path: join(root, '.cursor/skills/rules/SKILL.md') },
    });
    trackReadTsRef(stopBase);
    writeFileSync(
      join(root, '.cursor/hooks/_smoke-review-stop-probe.mjs'),
      'export const smokeReviewStopProbe = 1;\n',
    );
    run('track.mjs', {
      ...stopBase,
      hook_event_name: 'postToolUse',
      tool_name: 'Write',
      tool_input: { path: join(root, '.cursor/hooks/_smoke-review-stop-probe.mjs') },
    });

    const jsonl = join(transcriptsDir, childId, `${childId}.jsonl`);
    writeFileSync(
      jsonl,
      `${JSON.stringify({
        role: 'user',
        message: {
          content: [
            {
              type: 'text',
              text: `Full Repository Path: ${resolve(root)}\nDiff: uncommitted changes\n`,
            },
          ],
        },
      })}\n${JSON.stringify({
        role: 'assistant',
        message: { content: [{ type: 'text', text: 'REVIEW: PASS\n' }] },
      })}\n`,
    );

    run(
      'track.mjs',
      {
        ...stopBase,
        hook_event_name: 'stop',
        status: 'completed',
      },
      { CURSOR_GATE_TRANSCRIPTS_DIR: transcriptsDir },
    );
    const stStopped = loadState(root, stopId);
    assert(
      'stop clears review on unused PASS',
      Array.isArray(stStopped.review?.files) &&
        stStopped.review.files.length === 0 &&
        stStopped.review.dirtyAt == null,
      JSON.stringify(stStopped.review),
    );
    assert(
      'stop marks harness-pass-used',
      existsSync(reviewPassUsedPath(jsonl)),
      reviewPassUsedPath(jsonl),
    );

    const afterStopCommit = run(
      'gate.mjs',
      {
        ...stopBase,
        hook_event_name: 'beforeShellExecution',
        command: 'git commit -m test',
      },
      { CURSOR_GATE_TRANSCRIPTS_DIR: transcriptsDir },
    );
    assert(
      'commit allows after stop clear',
      afterStopCommit.permission === 'allow',
      JSON.stringify(afterStopCommit),
    );

    try {
      unlinkSync(join(root, '.cursor/hooks/_smoke-review-stop-probe.mjs'));
    } catch {
      // 無ければ無視
    }
  }
}

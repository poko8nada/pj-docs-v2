/** smoke: review */
import { utimesSync } from 'node:fs';
import { reviewNonceToken } from '../lib/review.mjs';

/** @param {import('./_harness.mjs').SmokeCtx} smoke */
export function runReviewGate(smoke) {
  // review gate (21)
  const {
    root,
    run,
    assert,
    trackReadTsRef,
    loadState,
    buildReviewTaskInjection,
    collectReviewDiff,
    readFileSync,
    unlinkSync,
    writeFileSync,
    mkdirSync,
    mkdtempSync,
    smokeTmpRoot,
    resolve,
    join,
  } = smoke;
  // 21. review gate: dirty → commit deny → reviewer → files clear → commit allow → re-edit
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
    writeFileSync(join(root, 'utils/_review-probe.ts'), 'export const reviewProbe = 1;\n');
    writeFileSync(
      join(root, '.cursor/hooks/_harness-review-probe.mjs'),
      'export const harnessReviewProbe = 1;\n',
    );
    trackReadTsRef(reviewBase);
    run('track.mjs', {
      ...reviewBase,
      hook_event_name: 'postToolUse',
      tool_name: 'Write',
      tool_input: { path: join(root, 'utils/_review-probe.ts') },
    });
    run('track.mjs', {
      ...reviewBase,
      hook_event_name: 'postToolUse',
      tool_name: 'Write',
      tool_input: { path: join(root, '.cursor/hooks/_harness-review-probe.mjs') },
    });
    const stDirty = loadState(root, reviewId);
    assert(
      'review files after edits',
      Array.isArray(stDirty.review?.files) &&
        stDirty.review.files.includes('utils/_review-probe.ts') &&
        stDirty.review.files.includes('.cursor/hooks/_harness-review-probe.mjs'),
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
        injected.includes('[harness-review-nonce:') &&
        injected.includes('utils/_review-probe.ts') &&
        injected.includes('.cursor/hooks/_harness-review-probe.mjs') &&
        injected.includes('reviewProbe') &&
        injected.includes('Do not run git') &&
        injectedTask.includes('[harness-review]'),
      JSON.stringify(injectOut),
    );
    try {
      unlinkSync(join(root, 'utils/_review-probe.ts'));
      unlinkSync(join(root, '.cursor/hooks/_harness-review-probe.mjs'));
    } catch {
      // 無ければ無視
    }

    const trackedPath = 'utils/types.ts';
    const trackedAbs = join(root, trackedPath);
    const trackedOriginal = readFileSync(trackedAbs, 'utf8');
    try {
      writeFileSync(trackedAbs, `${trackedOriginal}\n// smoke-tracked-diff-probe\n`);
      const got = collectReviewDiff(root, trackedPath);
      assert(
        'tracked edit yields kind diff',
        got.kind === 'diff' && got.body.includes('smoke-tracked-diff-probe'),
        JSON.stringify(got),
      );
      const block = buildReviewTaskInjection(root, [trackedPath]);
      assert(
        'injection includes diff fence for tracked edit',
        Boolean(block) &&
          block.includes('```diff') &&
          block.includes('smoke-tracked-diff-probe') &&
          block.includes(trackedPath),
        String(block).slice(0, 500),
      );
    } finally {
      writeFileSync(trackedAbs, trackedOriginal);
    }
    const stAfterInject = loadState(root, reviewId);
    assert(
      'preToolUse Task injects without clearing review.files',
      Array.isArray(stAfterInject.review?.files) &&
        stAfterInject.review.files.includes('utils/_review-probe.ts') &&
        typeof stAfterInject.review.dirtyAt === 'string',
      JSON.stringify(stAfterInject),
    );

    const transcriptsDir = mkdtempSync(join(smokeTmpRoot, 'review-gate-tx-'));
    const childId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    mkdirSync(join(transcriptsDir, childId), { recursive: true });
    const gateNonce = loadState(root, reviewId).review.nonce;
    const gateToken = reviewNonceToken(gateNonce);
    writeFileSync(
      join(transcriptsDir, childId, `${childId}.jsonl`),
      `${JSON.stringify({
        role: 'user',
        message: {
          content: [
            {
              type: 'text',
              text: `Full Repository Path: ${resolve(root)}\nDiff: uncommitted changes\n${gateToken}\n`,
            },
          ],
        },
      })}\n${JSON.stringify({
        role: 'assistant',
        message: {
          content: [{ type: 'text', text: `ack ${gateToken}\nREVIEW: PASS\n` }],
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
    assert(
      'PASS transcript after Task allows commit and clears files',
      allowCommit.permission === 'allow' &&
        Array.isArray(stReviewed.review?.files) &&
        stReviewed.review.files.length === 0 &&
        stReviewed.review.dirtyAt == null,
      JSON.stringify({ allowCommit, review: stReviewed.review }),
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
      command: 'git add .cursor/hooks/_missed-by-write.mjs utils/_from-add.ts',
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
      tool_input: { path: join(root, 'utils/_review-probe.ts') },
    });
    const stRedirty = loadState(root, reviewId);
    assert(
      're-edit refills review.files',
      Array.isArray(stRedirty.review?.files) &&
        stRedirty.review.files.includes('utils/_review-probe.ts'),
      JSON.stringify(stRedirty),
    );

    const denyAfterAddCommit = run('gate.mjs', {
      ...reviewBase,
      hook_event_name: 'beforeShellExecution',
      command: 'git add utils/_review-probe.ts && git commit -m test',
    });
    assert(
      'add&&commit still blocked while files non-empty',
      denyAfterAddCommit.permission === 'deny' &&
        String(denyAfterAddCommit.agent_message ?? denyAfterAddCommit.user_message ?? '').includes(
          'utils/_review-probe.ts',
        ),
      JSON.stringify(denyAfterAddCommit),
    );
  }

  // 21b. commit 時: dirtyAt 以降の子 transcript に REVIEW: PASS → clear
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

    const goodPrompt = () => {
      const n = loadState(root, passId).review.nonce;
      const token = reviewNonceToken(n);
      return `Full Repository Path: ${resolve(root)}\nDiff: uncommitted changes\n${token ? `${token}\n` : ''}`;
    };

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
    writeFileSync(join(root, 'utils/_review-pass-probe.ts'), 'export const reviewPassProbe = 1;\n');
    run('track.mjs', {
      ...passBase,
      hook_event_name: 'postToolUse',
      tool_name: 'Write',
      tool_input: { path: join(root, 'utils/_review-pass-probe.ts') },
    });
    const stDirty = loadState(root, passId);
    assert(
      'pass-scan dirty before transcript',
      stDirty.review.files.includes('utils/_review-pass-probe.ts') &&
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
        loadState(root, passId).review.files.includes('utils/_review-pass-probe.ts'),
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
        loadState(root, passId).review.files.includes('utils/_review-pass-probe.ts'),
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
        loadState(root, passId).review.files.includes('utils/_review-pass-probe.ts'),
      JSON.stringify(afterNoSig),
    );

    writeChildJsonl(
      'REVIEW: PASS\n',
      `Full Repository Path: ${resolve(root)}\nDiff: uncommitted changes\n[harness-review-nonce:deadbeefcafebabe]\n`,
    );
    const afterWrongNonce = run(
      'gate.mjs',
      {
        ...passBase,
        hook_event_name: 'beforeShellExecution',
        command: 'git commit -m test',
      },
      { CURSOR_GATE_TRANSCRIPTS_DIR: transcriptsDir },
    );
    assert(
      'PASS with wrong nonce does not clear',
      afterWrongNonce.permission === 'deny' &&
        loadState(root, passId).review.files.includes('utils/_review-pass-probe.ts'),
      JSON.stringify(afterWrongNonce),
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
    assert(
      'PASS transcript clears review and allows commit',
      afterPass.permission === 'allow' &&
        Array.isArray(stCleared.review?.files) &&
        stCleared.review.files.length === 0 &&
        stCleared.review.dirtyAt == null,
      JSON.stringify({ afterPass, review: stCleared.review }),
    );

    // 移行: dirtyAt null + files 非空でも PASS で clear できる
    saveState(root, passId, {
      phase: 'chore',
      review: { files: ['utils/_review-pass-probe.ts'], dirtyAt: null },
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
      'null dirtyAt still clears on PASS (migration)',
      afterNullDirty.permission === 'allow' && loadState(root, passId).review.files.length === 0,
      JSON.stringify({ afterNullDirty, review: loadState(root, passId).review }),
    );

    // 古い PASS 子 + 新しい GAPS 子 → 最新 mtime の verdict を採用し deny
    saveState(root, passId, {
      phase: 'chore',
      review: { files: ['utils/_review-pass-probe.ts'], dirtyAt: '2026-01-01T00:00:00+09:00' },
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
        loadState(root, passId).review.files.includes('utils/_review-pass-probe.ts'),
      JSON.stringify(afterNewerGaps),
    );

    try {
      unlinkSync(join(root, 'utils/_review-pass-probe.ts'));
    } catch {
      // 無ければ無視
    }
  }
}

/** smoke: review */

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
    const stReviewed = loadState(root, reviewId);
    assert(
      'preToolUse Task clears review.files',
      Array.isArray(stReviewed.review?.files) && stReviewed.review.files.length === 0,
      JSON.stringify(stReviewed),
    );

    const allowCommit = run('gate.mjs', {
      ...reviewBase,
      hook_event_name: 'beforeShellExecution',
      command: 'git commit -m test',
    });
    assert(
      'review allows git commit when files empty',
      allowCommit.permission === 'allow',
      JSON.stringify(allowCommit),
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
}

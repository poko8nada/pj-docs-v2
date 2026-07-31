/** smoke: check */

/** @param {import('./_harness.mjs').SmokeCtx} smoke */
export function runCheckPending(smoke) {
  // check pending/stop (22)
  const {
    root,
    smokeTmpRoot,
    run,
    assert,
    loadState,
    isCheckToolingReady,
    runFormatLint,
    mkdirSync,
    mkdtempSync,
    saveState,
    writeFileSync,
    join,
  } = smoke;
  // 22. check: pending → stop format/lint → reset
  {
    const checkId = 'check-gate-id';
    const checkBase = { conversation_id: checkId, workspace_roots: [root], cwd: root };
    run('track.mjs', {
      ...checkBase,
      hook_event_name: 'beforeSubmitPrompt',
      prompt: '/chore check test',
    });
    run('track.mjs', {
      ...checkBase,
      hook_event_name: 'preToolUse',
      tool_name: 'ReadFile',
      tool_input: { path: join(root, '.cursor/skills/scope/SKILL.md') },
    });
    run('track.mjs', {
      ...checkBase,
      hook_event_name: 'preToolUse',
      tool_name: 'ReadFile',
      tool_input: { path: join(root, '.cursor/skills/rules/SKILL.md') },
    });
    run(
      'track.mjs',
      {
        ...checkBase,
        hook_event_name: 'postToolUse',
        tool_name: 'Write',
        tool_input: { path: join(root, 'utils/types.ts') },
      },
      { CURSOR_CHECK_DRY_RUN: '1' },
    );
    const stPending = loadState(root, checkId);
    assert(
      'check pending after product write',
      stPending.check?.pending?.includes('utils/types.ts'),
      JSON.stringify(stPending.check),
    );

    run(
      'track.mjs',
      {
        ...checkBase,
        hook_event_name: 'postToolUse',
        tool_name: 'Write',
        tool_input: { path: join(root, '.cursor/hooks/_probe-check.mjs') },
      },
      { CURSOR_CHECK_DRY_RUN: '1' },
    );
    const stHarness = loadState(root, checkId);
    assert(
      'harness write adds check pending',
      stHarness.check?.pending?.includes('.cursor/hooks/_probe-check.mjs'),
      JSON.stringify(stHarness.check),
    );

    const outOk = run(
      'check.mjs',
      { ...checkBase, hook_event_name: 'stop', status: 'completed', loop_count: 0 },
      { CURSOR_CHECK_DRY_RUN: '1' },
    );
    assert('stop dry-run succeeds', !outOk.followup_message, JSON.stringify(outOk));
    const stCleared = loadState(root, checkId);
    assert(
      'stop clears check pending',
      stCleared.check?.pending?.length === 0,
      JSON.stringify(stCleared),
    );

    run(
      'track.mjs',
      {
        ...checkBase,
        hook_event_name: 'postToolUse',
        tool_name: 'Write',
        tool_input: { path: join(root, 'utils/types.ts') },
      },
      { CURSOR_CHECK_DRY_RUN: '1' },
    );
    const outFail = run(
      'check.mjs',
      { ...checkBase, hook_event_name: 'stop', status: 'completed', loop_count: 0 },
      { CURSOR_CHECK_DRY_RUN: 'fail' },
    );
    assert(
      'stop failure emits followup_message',
      typeof outFail.followup_message === 'string' &&
        outFail.followup_message.includes('harness-check'),
      JSON.stringify(outFail),
    );

    run(
      'track.mjs',
      {
        ...checkBase,
        hook_event_name: 'postToolUse',
        tool_name: 'Write',
        tool_input: { path: join(root, 'utils/types.ts') },
      },
      { CURSOR_CHECK_DRY_RUN: '1' },
    );
    const outLoop = run(
      'check.mjs',
      { ...checkBase, hook_event_name: 'stop', status: 'completed', loop_count: 1 },
      { CURSOR_CHECK_DRY_RUN: 'fail' },
    );
    assert(
      'stop at loop_count 1 clears pending without followup',
      !outLoop.followup_message,
      JSON.stringify(outLoop),
    );
    const stLoop = loadState(root, checkId);
    assert(
      'loop_count stop clears pending',
      stLoop.check?.pending?.length === 0,
      JSON.stringify(stLoop),
    );

    // deps 未 install なら deny-format 形式でセットアップを要求する
    {
      const noDepsRoot = mkdtempSync(join(smokeTmpRoot, 'no-deps-'));
      writeFileSync(join(noDepsRoot, 'probe.mjs'), 'export const x = 1;\n');
      assert(
        'tooling not ready without node_modules packages',
        !isCheckToolingReady(noDepsRoot),
        noDepsRoot,
      );
      const direct = runFormatLint(noDepsRoot, ['probe.mjs']);
      assert(
        'runFormatLint reports missing tooling',
        !direct.ok &&
          direct.kind === 'tooling-missing' &&
          direct.message?.startsWith('[harness-check] BLOCKED') &&
          direct.message.includes('oxfmt') &&
          direct.message.includes('oxlint') &&
          direct.message.includes('pnpm install --frozen-lockfile') &&
          direct.message.includes('Do not:'),
        JSON.stringify(direct),
      );

      const typecheckRoot = mkdtempSync(join(smokeTmpRoot, 'typecheck-missing-'));
      writeFileSync(join(typecheckRoot, 'probe.ts'), 'export const x: number = 1;\n');
      mkdirSync(join(typecheckRoot, 'node_modules', 'oxfmt'), { recursive: true });
      mkdirSync(join(typecheckRoot, 'node_modules', 'oxlint'), { recursive: true });
      const typecheckMissing = runFormatLint(typecheckRoot, ['probe.ts']);
      assert(
        'typecheck reports only missing typecheck tooling',
        !typecheckMissing.ok &&
          typecheckMissing.kind === 'tooling-missing' &&
          typecheckMissing.message.includes('tsc-files') &&
          typecheckMissing.message.includes('typescript') &&
          !typecheckMissing.message.includes('oxfmt,'),
        JSON.stringify(typecheckMissing),
      );

      const missingCheckId = 'check-missing-tooling-id';
      const missingCheckBase = {
        conversation_id: missingCheckId,
        workspace_roots: [noDepsRoot],
        cwd: noDepsRoot,
      };
      run('track.mjs', {
        ...missingCheckBase,
        hook_event_name: 'beforeSubmitPrompt',
        prompt: '/chore check missing tooling',
      });
      saveState(noDepsRoot, missingCheckId, {
        phase: 'chore',
        unlock: { rules: true, scope: true },
        check: { pending: ['probe.mjs'] },
      });
      const missingStop = run('check.mjs', {
        ...missingCheckBase,
        hook_event_name: 'stop',
        status: 'completed',
        loop_count: 0,
      });
      assert(
        'missing tooling emits deny-format followup',
        missingStop.followup_message?.startsWith('[harness-check] BLOCKED') &&
          missingStop.followup_message.includes('pnpm install --frozen-lockfile'),
        JSON.stringify(missingStop),
      );
      assert(
        'missing tooling retains pending',
        loadState(noDepsRoot, missingCheckId).check?.pending?.includes('probe.mjs'),
        JSON.stringify(loadState(noDepsRoot, missingCheckId)),
      );
      const missingLoop = run('check.mjs', {
        ...missingCheckBase,
        hook_event_name: 'stop',
        status: 'completed',
        loop_count: 1,
      });
      assert(
        'missing tooling at loop limit retains pending without followup',
        !missingLoop.followup_message &&
          loadState(noDepsRoot, missingCheckId).check?.pending?.includes('probe.mjs'),
        JSON.stringify(missingLoop),
      );
      const missingPrompt = run('check.mjs', {
        ...missingCheckBase,
        hook_event_name: 'beforeSubmitPrompt',
        prompt: 'continue',
      });
      assert(
        'beforeSubmitPrompt returns deny-format setup message',
        missingPrompt.continue === false &&
          missingPrompt.user_message?.startsWith('[harness-check] BLOCKED'),
        JSON.stringify(missingPrompt),
      );

      mkdirSync(join(noDepsRoot, 'node_modules', 'oxfmt'), { recursive: true });
      mkdirSync(join(noDepsRoot, 'node_modules', 'oxlint'), { recursive: true });
      const localBin = mkdtempSync(join(smokeTmpRoot, 'local-bin-'));
      writeFileSync(join(localBin, 'pnpm'), '#!/bin/sh\nexit 0\n', { mode: 0o755 });
      const previousPath = process.env.PATH;
      process.env.PATH = `${localBin}${previousPath ? `:${previousPath}` : ''}`;
      try {
        const retried = run('check.mjs', {
          ...missingCheckBase,
          hook_event_name: 'stop',
          status: 'completed',
          loop_count: 0,
        });
        assert('local check succeeds after tooling install', !retried.followup_message);
        assert(
          'successful retry clears pending',
          loadState(noDepsRoot, missingCheckId).check?.pending?.length === 0,
          JSON.stringify(loadState(noDepsRoot, missingCheckId)),
        );
      } finally {
        if (previousPath === undefined) delete process.env.PATH;
        else process.env.PATH = previousPath;
      }
    }

    run(
      'track.mjs',
      {
        ...checkBase,
        hook_event_name: 'postToolUse',
        tool_name: 'Write',
        tool_input: { path: join(root, 'utils/types.ts') },
      },
      { CURSOR_CHECK_DRY_RUN: '1' },
    );
    run('track.mjs', {
      ...checkBase,
      hook_event_name: 'afterShellExecution',
      command: 'git commit -m test',
      exit_code: 0,
    });
    const stCommitReset = loadState(root, checkId);
    assert(
      'successful commit clears check pending',
      stCommitReset.check?.pending?.length === 0,
      JSON.stringify(stCommitReset.check),
    );
  }

  // dirty 直後 format 失敗 → additional_context のみ（pending は残す・commit gate にはしない）
  {
    const { clearSticky, trackReadTsRef } = smoke;
    clearSticky();
    const formatId = 'check-format-dirty-id';
    const formatBase = { conversation_id: formatId, workspace_roots: [root], cwd: root };
    run('track.mjs', {
      ...formatBase,
      hook_event_name: 'beforeSubmitPrompt',
      prompt: '/chore format dirty',
    });
    run('track.mjs', {
      ...formatBase,
      hook_event_name: 'preToolUse',
      tool_name: 'ReadFile',
      tool_input: { path: join(root, '.cursor/skills/scope/SKILL.md') },
    });
    run('track.mjs', {
      ...formatBase,
      hook_event_name: 'preToolUse',
      tool_name: 'ReadFile',
      tool_input: { path: join(root, '.cursor/skills/rules/SKILL.md') },
    });
    trackReadTsRef(formatBase);

    const formatOut = run(
      'track.mjs',
      {
        ...formatBase,
        hook_event_name: 'postToolUse',
        tool_name: 'Write',
        tool_input: { path: join(root, 'utils/types.ts') },
      },
      { CURSOR_CHECK_DRY_RUN: 'fail' },
    );
    const stFormatFail = loadState(root, formatId);
    assert(
      'format-on-dirty failure returns additional_context',
      typeof formatOut.additional_context === 'string' &&
        formatOut.additional_context.includes('format failed') &&
        formatOut.additional_context.includes('dry-run: format failed'),
      JSON.stringify(formatOut),
    );
    assert(
      'format-on-dirty failure still marks pending',
      stFormatFail.check?.pending?.includes('utils/types.ts'),
      JSON.stringify(stFormatFail.check),
    );
    assert(
      'format-on-dirty failure still marks review.files',
      stFormatFail.review?.files?.includes('utils/types.ts'),
      JSON.stringify(stFormatFail.review),
    );
  }
}

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
    mkdtempSync,
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
    run('track.mjs', {
      ...checkBase,
      hook_event_name: 'postToolUse',
      tool_name: 'Write',
      tool_input: { path: join(root, 'utils/types.ts') },
    });
    const stPending = loadState(root, checkId);
    assert(
      'check pending after product write',
      stPending.check?.pending?.includes('utils/types.ts'),
      JSON.stringify(stPending.check),
    );

    run('track.mjs', {
      ...checkBase,
      hook_event_name: 'postToolUse',
      tool_name: 'Write',
      tool_input: { path: join(root, '.cursor/hooks/_probe-check.mjs') },
    });
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

    run('track.mjs', {
      ...checkBase,
      hook_event_name: 'postToolUse',
      tool_name: 'Write',
      tool_input: { path: join(root, 'utils/types.ts') },
    });
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

    run('track.mjs', {
      ...checkBase,
      hook_event_name: 'postToolUse',
      tool_name: 'Write',
      tool_input: { path: join(root, 'utils/types.ts') },
    });
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

    // deps 未 install なら format/lint を失敗にせずスキップする
    {
      const noDepsRoot = mkdtempSync(join(smokeTmpRoot, 'no-deps-'));
      writeFileSync(join(noDepsRoot, 'probe.mjs'), 'export const x = 1;\n');
      assert(
        'tooling not ready without node_modules packages',
        !isCheckToolingReady(noDepsRoot),
        noDepsRoot,
      );
      const skipped = runFormatLint(noDepsRoot, ['probe.mjs']);
      assert('runFormatLint skips when deps missing', skipped.ok, JSON.stringify(skipped));
    }

    run('track.mjs', {
      ...checkBase,
      hook_event_name: 'postToolUse',
      tool_name: 'Write',
      tool_input: { path: join(root, 'utils/types.ts') },
    });
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
}

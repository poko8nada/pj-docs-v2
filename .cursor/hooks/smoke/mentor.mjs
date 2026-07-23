/** smoke: mentor */

/** @param {import('./_harness.mjs').SmokeCtx} smoke */
export function runMentorStub(smoke) {
  // mentor / stub (旧18)
  const {
    root,
    run,
    assert,
    clearSticky,
    trackRead,
    trackReadTsRef,
    loadState,
    isStubTurnActive,
    lastStubPath,
    isReviewablePath,
    existsSync,
    unlinkSync,
    join,
  } = smoke;
  // 18. mentor / stub（コード deny・stub 1ターン・mentor OFF で stub no-op）
  {
    const mentorId = 'test-mentor';
    const mentorBase = {
      conversation_id: mentorId,
      session_id: mentorId,
      workspace_roots: [root],
      cwd: root,
    };
    clearSticky();
    run('track.mjs', {
      ...mentorBase,
      hook_event_name: 'beforeSubmitPrompt',
      prompt: '/chore /mentor',
    });
    assert('mentor on in state', loadState(root, mentorId).mentor === true);
    assert('chore phase with mentor', loadState(root, mentorId).phase === 'chore');

    trackRead(mentorBase, '.cursor/skills/rules/SKILL.md');
    trackReadTsRef(mentorBase);
    assert('mentor unlock.rules', loadState(root, mentorId).unlock.rules === true);

    const codePath = join(root, '.cursor/hooks/_mentor-smoke-probe.ts');
    const denyCode = run('gate.mjs', {
      ...mentorBase,
      hook_event_name: 'preToolUse',
      tool_name: 'Write',
      tool_input: { path: codePath, contents: 'export {}\n' },
    });
    assert(
      'mentor denies code Write without stub',
      denyCode.permission === 'deny' && String(denyCode.agent_message).includes('[gate-mentor]'),
      JSON.stringify(denyCode),
    );

    const mdPath = join(root, '.cursor/hooks/_mentor-smoke-note.md');
    const allowMd = run('gate.mjs', {
      ...mentorBase,
      hook_event_name: 'preToolUse',
      tool_name: 'Write',
      tool_input: { path: mdPath, contents: '# note\n' },
    });
    assert('mentor allows md Write', allowMd.permission === 'allow', JSON.stringify(allowMd));

    assert('html is reviewable', isReviewablePath(root, join(root, 'x.html')) === true);

    // mentor OFF の /stub は no-op
    run('track.mjs', {
      ...mentorBase,
      hook_event_name: 'beforeSubmitPrompt',
      prompt: '/mentor off',
    });
    assert('mentor off', loadState(root, mentorId).mentor === false);
    run('track.mjs', {
      ...mentorBase,
      hook_event_name: 'beforeSubmitPrompt',
      prompt: '/stub please',
    });
    assert('stub no-op when mentor off', isStubTurnActive(root, mentorId) === false);
    assert('no last-stub file when no-op', !existsSync(lastStubPath(root)));

    // mentor ON + /stub → 1ターンコード可
    run('track.mjs', {
      ...mentorBase,
      hook_event_name: 'beforeSubmitPrompt',
      prompt: '/mentor',
    });
    run('track.mjs', {
      ...mentorBase,
      hook_event_name: 'beforeSubmitPrompt',
      prompt: '/stub scaffold',
    });
    assert('stub active this turn', isStubTurnActive(root, mentorId) === true);
    trackRead(mentorBase, '.cursor/skills/rules/SKILL.md');
    trackReadTsRef(mentorBase);
    const allowCode = run('gate.mjs', {
      ...mentorBase,
      hook_event_name: 'preToolUse',
      tool_name: 'Write',
      tool_input: { path: codePath, contents: 'export const x = 1\n' },
    });
    assert('stub allows code Write', allowCode.permission === 'allow', JSON.stringify(allowCode));

    // 次発話で stub 消える
    run('track.mjs', {
      ...mentorBase,
      hook_event_name: 'beforeSubmitPrompt',
      prompt: 'continue without stub',
    });
    assert('stub cleared next prompt', isStubTurnActive(root, mentorId) === false);
    trackRead(mentorBase, '.cursor/skills/rules/SKILL.md');
    trackReadTsRef(mentorBase);
    const denyAgain = run('gate.mjs', {
      ...mentorBase,
      hook_event_name: 'preToolUse',
      tool_name: 'Write',
      tool_input: { path: codePath, contents: 'export {}\n' },
    });
    assert(
      'mentor denies code again after stub turn',
      denyAgain.permission === 'deny',
      JSON.stringify(denyAgain),
    );

    try {
      unlinkSync(codePath);
    } catch {
      // 無ければ無視
    }
    try {
      unlinkSync(mdPath);
    } catch {
      // 無ければ無視
    }

    // Shell: 絶対・相対のコード path を mentor 下で deny
    run('track.mjs', {
      ...mentorBase,
      hook_event_name: 'beforeSubmitPrompt',
      prompt: 'stay mentor for shell checks',
    });
    trackRead(mentorBase, '.cursor/skills/rules/SKILL.md');
    trackReadTsRef(mentorBase);
    const denyShellAbs = run('gate.mjs', {
      ...mentorBase,
      hook_event_name: 'beforeShellExecution',
      command: `tee ${codePath}`,
    });
    assert(
      'mentor denies shell touching abs code path',
      denyShellAbs.permission === 'deny' &&
        String(denyShellAbs.agent_message).includes('[gate-mentor]'),
      JSON.stringify(denyShellAbs),
    );
    const denyShellRel = run('gate.mjs', {
      ...mentorBase,
      hook_event_name: 'beforeShellExecution',
      command: 'tee .cursor/hooks/_mentor-smoke-probe.ts',
    });
    assert(
      'mentor denies shell touching relative code path',
      denyShellRel.permission === 'deny' &&
        String(denyShellRel.agent_message).includes('[gate-mentor]'),
      JSON.stringify(denyShellRel),
    );
    const allowShellRo = run('gate.mjs', {
      ...mentorBase,
      hook_event_name: 'beforeShellExecution',
      command: 'ls .cursor/hooks/_mentor.mjs',
    });
    assert(
      'mentor allows readonly shell',
      allowShellRo.permission === 'allow',
      JSON.stringify(allowShellRo),
    );
    const denyShellGit = run('gate.mjs', {
      ...mentorBase,
      hook_event_name: 'beforeShellExecution',
      command: 'git checkout -- .cursor/hooks/_mentor-smoke-probe.ts',
    });
    assert(
      'mentor denies git write touching code path',
      denyShellGit.permission === 'deny' &&
        String(denyShellGit.agent_message).includes('[gate-mentor]'),
      JSON.stringify(denyShellGit),
    );
    const denyShellEcho = run('gate.mjs', {
      ...mentorBase,
      hook_event_name: 'beforeShellExecution',
      command: 'echo x > .cursor/hooks/_mentor-smoke-probe.ts',
    });
    assert(
      'mentor denies echo redirect to code path',
      denyShellEcho.permission === 'deny' &&
        String(denyShellEcho.agent_message).includes('[gate-mentor]'),
      JSON.stringify(denyShellEcho),
    );

    clearSticky();
  }
}

/** @param {import('./_harness.mjs').SmokeCtx} smoke */
export function runPnpmEarly(smoke) {
  // pnpm test early allow (旧19)
  const { root, run, assert, clearSticky, loadState } = smoke;
  // 19. pnpm test early allow (work|chore, no rules unlock)
  {
    const testId = 'test-pnpm-early';
    const testBase = {
      conversation_id: testId,
      session_id: testId,
      workspace_roots: [root],
      cwd: root,
    };
    clearSticky();
    run('track.mjs', {
      ...testBase,
      hook_event_name: 'beforeSubmitPrompt',
      prompt: '/work',
    });
    const stWork = loadState(root, testId);
    assert(
      'pnpm early work phase without rules',
      stWork.phase === 'work' && stWork.unlock.rules !== true,
      JSON.stringify(stWork),
    );

    const allowBare = run('gate.mjs', {
      ...testBase,
      hook_event_name: 'beforeShellExecution',
      command: 'pnpm test:run',
    });
    assert(
      'pnpm test:run without rules unlock',
      allowBare.permission === 'allow',
      JSON.stringify(allowBare),
    );

    const allowPath = run('gate.mjs', {
      ...testBase,
      hook_event_name: 'beforeShellExecution',
      command: 'pnpm test:run src/foo.test.ts',
    });
    assert(
      'pnpm test:run with path without rules',
      allowPath.permission === 'allow',
      JSON.stringify(allowPath),
    );

    run('track.mjs', {
      ...testBase,
      hook_event_name: 'beforeSubmitPrompt',
      prompt: '/mentor',
    });
    const allowMentor = run('gate.mjs', {
      ...testBase,
      hook_event_name: 'beforeShellExecution',
      command: 'pnpm test:run src/foo.test.ts',
    });
    assert(
      'mentor pnpm test without rules unlock',
      allowMentor.permission === 'allow',
      JSON.stringify(allowMentor),
    );

    const denyInstall = run('gate.mjs', {
      ...testBase,
      hook_event_name: 'beforeShellExecution',
      command: 'pnpm install',
    });
    assert(
      'pnpm install still deny without rules',
      denyInstall.permission === 'deny',
      JSON.stringify(denyInstall),
    );

    const denyChain = run('gate.mjs', {
      ...testBase,
      hook_event_name: 'beforeShellExecution',
      command: 'pnpm test:run && tee src/foo.ts',
    });
    assert(
      'pnpm test chain with write deny',
      denyChain.permission === 'deny',
      JSON.stringify(denyChain),
    );

    const discId = 'test-pnpm-discussion';
    const discBase = {
      conversation_id: discId,
      session_id: discId,
      workspace_roots: [root],
      cwd: root,
    };
    run('track.mjs', {
      ...discBase,
      hook_event_name: 'beforeSubmitPrompt',
      prompt: '/discussion',
    });
    const denyDisc = run('gate.mjs', {
      ...discBase,
      hook_event_name: 'beforeShellExecution',
      command: 'pnpm test:run',
    });
    assert(
      'discussion pnpm test still deny',
      denyDisc.permission === 'deny',
      JSON.stringify(denyDisc),
    );

    clearSticky();
  }
}

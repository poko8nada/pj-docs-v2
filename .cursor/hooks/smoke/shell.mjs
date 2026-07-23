/** smoke: shell */

/** @param {import('./_harness.mjs').SmokeCtx} smoke */
export function runCdRoot(smoke) {
  // root への cd 拒否 (旧20)
  const { root, run, assert, loadState, join } = smoke;
  // 20. gate: root への cd は拒否
  {
    const cdId = 'cd-root-test-id';
    const cdBase = { conversation_id: cdId, workspace_roots: [root], cwd: root };
    run('track.mjs', {
      ...cdBase,
      hook_event_name: 'beforeSubmitPrompt',
      prompt: '/chore cd test',
    });
    run('track.mjs', {
      ...cdBase,
      hook_event_name: 'preToolUse',
      tool_name: 'ReadFile',
      tool_input: { path: join(root, '.cursor/skills/rules/SKILL.md') },
    });
    const stCd = loadState(root, cdId);
    assert(
      'cd test conversation unlocked',
      stCd.phase === 'chore' && stCd.unlock.rules === true,
      JSON.stringify(stCd),
    );

    const denyAbs = run('gate.mjs', {
      ...cdBase,
      hook_event_name: 'beforeShellExecution',
      command: `cd ${root} && pnpm test`,
    });
    assert('reject cd to workspace root', denyAbs.permission === 'deny', JSON.stringify(denyAbs));

    const denyDot = run('gate.mjs', {
      ...cdBase,
      hook_event_name: 'beforeShellExecution',
      command: 'cd . && pnpm test',
    });
    assert('reject cd . at root', denyDot.permission === 'deny', JSON.stringify(denyDot));

    const denyChain = run('gate.mjs', {
      ...cdBase,
      hook_event_name: 'beforeShellExecution',
      command: 'cd utils && cd ..',
    });
    assert(
      'reject cd utils then cd ..',
      denyChain.permission === 'deny',
      JSON.stringify(denyChain),
    );

    const allowSub = run('gate.mjs', {
      ...cdBase,
      hook_event_name: 'beforeShellExecution',
      command: 'cd utils && pnpm test',
    });
    assert('allow cd into subdir', allowSub.permission === 'allow', JSON.stringify(allowSub));

    const allowPlain = run('gate.mjs', {
      ...cdBase,
      hook_event_name: 'beforeShellExecution',
      command: 'pnpm test',
    });
    assert(
      'allow command without cd',
      allowPlain.permission === 'allow',
      JSON.stringify(allowPlain),
    );

    const allowParent = run('gate.mjs', {
      ...cdBase,
      hook_event_name: 'beforeShellExecution',
      command: 'cd ..',
    });
    assert(
      'allow cd .. from root',
      allowParent.permission === 'allow',
      JSON.stringify(allowParent),
    );
  }
}

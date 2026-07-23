/** smoke: refs */

/** @param {import('./_harness.mjs').SmokeCtx} smoke */
export function runReadRefs(smoke) {
  // readRefs 弱ゲート (23)
  const { root, run, assert, trackRead, join } = smoke;
  // 23. readRefs gate: 弱ゲート（rules/references を1つ以上）
  {
    const refsId = 'refs-gate-id';
    const refsBase = { conversation_id: refsId, workspace_roots: [root], cwd: root };
    run('track.mjs', {
      ...refsBase,
      hook_event_name: 'beforeSubmitPrompt',
      prompt: '/chore refs test',
    });
    run('track.mjs', {
      ...refsBase,
      hook_event_name: 'preToolUse',
      tool_name: 'ReadFile',
      tool_input: { path: join(root, '.cursor/skills/rules/SKILL.md') },
    });

    const denyMd = run('gate.mjs', {
      ...refsBase,
      hook_event_name: 'preToolUse',
      tool_name: 'Write',
      tool_input: { path: join(root, 'docs/note.md') },
    });
    assert(
      'md write without rules ref deny',
      denyMd.permission === 'deny' &&
        String(denyMd.agent_message ?? '').includes('at least one file') &&
        String(denyMd.agent_message ?? '').includes('rules/references'),
      JSON.stringify(denyMd),
    );

    const denyTest = run('gate.mjs', {
      ...refsBase,
      hook_event_name: 'preToolUse',
      tool_name: 'Write',
      tool_input: { path: join(root, 'utils/foo.test.ts') },
    });
    assert(
      'test write without rules ref deny',
      denyTest.permission === 'deny' &&
        String(denyTest.agent_message ?? '').includes('rules/references'),
      JSON.stringify(denyTest),
    );

    const denyCss = run('gate.mjs', {
      ...refsBase,
      hook_event_name: 'preToolUse',
      tool_name: 'Write',
      tool_input: { path: join(root, 'styles/app.css') },
    });
    assert(
      'css write without rules ref deny',
      denyCss.permission === 'deny' &&
        String(denyCss.agent_message ?? '').includes('rules/references'),
      JSON.stringify(denyCss),
    );

    const allowMjs = run('gate.mjs', {
      ...refsBase,
      hook_event_name: 'preToolUse',
      tool_name: 'Write',
      tool_input: { path: join(root, '.cursor/hooks/_refs-probe.mjs') },
    });
    assert(
      'mjs write needs no reference',
      allowMjs.permission === 'allow',
      JSON.stringify(allowMjs),
    );

    trackRead(refsBase, '.cursor/skills/rules/references/documents.md');
    const allowMd = run('gate.mjs', {
      ...refsBase,
      hook_event_name: 'preToolUse',
      tool_name: 'Write',
      tool_input: { path: join(root, 'docs/note.md') },
    });
    assert(
      'md write after any rules ref allow',
      allowMd.permission === 'allow',
      JSON.stringify(allowMd),
    );

    const allowTest = run('gate.mjs', {
      ...refsBase,
      hook_event_name: 'preToolUse',
      tool_name: 'Write',
      tool_input: { path: join(root, 'utils/foo.test.ts') },
    });
    assert(
      'test write after any rules ref allow',
      allowTest.permission === 'allow',
      JSON.stringify(allowTest),
    );

    const allowCss = run('gate.mjs', {
      ...refsBase,
      hook_event_name: 'preToolUse',
      tool_name: 'Write',
      tool_input: { path: join(root, 'styles/app.css') },
    });
    assert(
      'css write after any rules ref allow',
      allowCss.permission === 'allow',
      JSON.stringify(allowCss),
    );

    const allowTs = run('gate.mjs', {
      ...refsBase,
      hook_event_name: 'preToolUse',
      tool_name: 'Write',
      tool_input: { path: join(root, 'utils/foo.ts') },
    });
    assert(
      'ts write after any rules ref allow',
      allowTs.permission === 'allow',
      JSON.stringify(allowTs),
    );
  }
}

/** @param {import('./_harness.mjs').SmokeCtx} smoke */
export function runIssueHeredoc(smoke) {
  // issue process-sub heredoc (旧21)
  const { root, run, assert, trackRead, trackReadIssueSkill, loadState, join } = smoke;
  // 21. work + issue ready: gh issue edit with process-sub heredoc allows
  //     （旧バグ: heredoc 除去後の改行で `)` が単独セグメント → DENY_SHELL）
  {
    const heredocId = 'heredoc00-0000-4000-8000-000000000001';
    const heredocBase = {
      conversation_id: heredocId,
      workspace_roots: [root],
      cwd: root,
    };
    run('track.mjs', {
      ...heredocBase,
      hook_event_name: 'beforeSubmitPrompt',
      prompt: '/work heredoc allow',
    });
    trackReadIssueSkill(heredocBase);
    trackRead(heredocBase, '.cursor/skills/issue/references/build-template.md');
    const st = loadState(root, heredocId);
    assert(
      'heredoc case issue ready',
      st.phase === 'work' &&
        st.unlock.issue === true &&
        Array.isArray(st.read.refs) &&
        st.read.refs.includes('issue/build-template.md'),
      JSON.stringify(st),
    );

    const cmd = [
      "gh issue edit 6 --body-file <(cat <<'EOF'",
      '# Grain',
      'foo | bar',
      '# Tokens',
      'a | b',
      'EOF',
      ") && gh issue comment 6 --body \"$(cat <<'EOF'",
      '## update | note',
      'EOF',
      ')"',
    ].join('\n');

    const out = run('gate.mjs', {
      ...heredocBase,
      hook_event_name: 'beforeShellExecution',
      command: cmd,
    });
    assert('work gh process-sub heredoc allow', out.permission === 'allow', JSON.stringify(out));

    // 改行を潰すと `git status\npnpm` が git 1セグメント扱いになり bypass する
    const outBypass = run('gate.mjs', {
      ...heredocBase,
      hook_event_name: 'beforeShellExecution',
      command: 'git status\npnpm test',
    });
    assert(
      'multiline git then pnpm denies (no newline collapse bypass)',
      outBypass.permission === 'deny',
      JSON.stringify(outBypass),
    );
    const outBypassGh = run('gate.mjs', {
      ...heredocBase,
      hook_event_name: 'beforeShellExecution',
      command: 'gh issue list\npnpm test',
    });
    assert(
      'multiline gh then pnpm denies (no newline collapse bypass)',
      outBypassGh.permission === 'deny',
      JSON.stringify(outBypassGh),
    );

    // rules 前でも pnpm test は work で allow。install は deny
    const outPnpm = run('gate.mjs', {
      ...heredocBase,
      hook_event_name: 'beforeShellExecution',
      command: 'pnpm test',
    });
    assert(
      'work pnpm test allow without rules',
      outPnpm.permission === 'allow',
      JSON.stringify(outPnpm),
    );

    const outPnpmInstall = run('gate.mjs', {
      ...heredocBase,
      hook_event_name: 'beforeShellExecution',
      command: 'pnpm install',
    });
    const msg = String(outPnpmInstall.agent_message ?? '');
    assert(
      'work pnpm install deny names phase',
      outPnpmInstall.permission === 'deny' && msg.includes('phase=work'),
      JSON.stringify(outPnpmInstall),
    );
    assert(
      'work pnpm install deny does not claim discussion',
      !msg.includes('In discussion:'),
      msg,
    );

    const outWrite = run('gate.mjs', {
      ...heredocBase,
      hook_event_name: 'preToolUse',
      tool_name: 'Write',
      tool_input: { path: join(root, 'utils/foo.ts') },
    });
    const writeMsg = String(outWrite.agent_message ?? '');
    assert(
      'work Write deny names phase+rules',
      outWrite.permission === 'deny' &&
        writeMsg.includes('phase=work') &&
        writeMsg.includes('rules'),
      JSON.stringify(outWrite),
    );
    assert(
      'work Write deny does not say Default phase is discussion',
      !writeMsg.includes('Default phase is discussion'),
      writeMsg,
    );
  }
}

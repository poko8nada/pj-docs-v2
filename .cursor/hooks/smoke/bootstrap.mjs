/** smoke: bootstrap */

/** @param {import('./_harness.mjs').SmokeCtx} smoke */
export function runBootstrap(smoke) {
  // bootstrap on/off + sessionEnd (17–19)
  const {
    root,
    stateTmp,
    base,
    run,
    assert,
    clearSticky,
    stateAbs,
    formatJstIso,
    PHASE_DISCUSSION,
    bootstrapMarkerPath,
    disableBootstrap,
    enableBootstrap,
    isBootstrapActive,
    unlinkSync,
    writeFileSync,
    join,
  } = smoke;
  // 17. bootstrap: discussion でも gate バイパス（state / マーカー編集は除く）
  {
    enableBootstrap(root);
    assert('bootstrap marker active', isBootstrapActive(root));
    const out = run('gate.mjs', {
      ...base,
      hook_event_name: 'beforeShellExecution',
      command: 'node -e 1',
    });
    assert('bootstrap allows node shell', out.permission === 'allow', JSON.stringify(out));
    const outWrite = run('gate.mjs', {
      ...base,
      hook_event_name: 'preToolUse',
      tool_name: 'Write',
      tool_input: { path: join(root, '.cursor/hooks/_bootstrap-probe.txt') },
    });
    assert(
      'bootstrap allows .cursor write',
      outWrite.permission === 'allow',
      JSON.stringify(outWrite),
    );
    try {
      unlinkSync(join(root, '.cursor/hooks/_bootstrap-probe.txt'));
    } catch {
      // 無ければ無視
    }
    const outMarker = run('gate.mjs', {
      ...base,
      hook_event_name: 'preToolUse',
      tool_name: 'Write',
      tool_input: { path: bootstrapMarkerPath(root) },
    });
    assert(
      'bootstrap still denies marker Write',
      outMarker.permission === 'deny',
      JSON.stringify(outMarker),
    );
    disableBootstrap(root);
    clearSticky();
    writeFileSync(
      stateAbs(),
      JSON.stringify(
        { phase: PHASE_DISCUSSION, implement: null, updatedAt: formatJstIso() },
        null,
        2,
      ) + '\n',
    );
    const outLocked = run('gate.mjs', {
      ...base,
      hook_event_name: 'beforeShellExecution',
      command: 'node -e 1',
    });
    assert('off bootstrap denies node', outLocked.permission === 'deny', JSON.stringify(outLocked));
  }

  // 17b. entry: core が壊れても bootstrap 中は allow（entry 救命胴衣）
  {
    const brokenCore = join(stateTmp, 'broken-core.mjs');
    writeFileSync(
      brokenCore,
      'export async function handleGate() { throw new Error("core-boom"); }\n',
    );
    enableBootstrap(root);
    const outAllow = run(
      'gate.mjs',
      {
        ...base,
        hook_event_name: 'beforeShellExecution',
        command: 'node -e 1',
      },
      { CURSOR_GATE_CORE_PATH: brokenCore },
    );
    assert(
      'broken core + bootstrap allows',
      outAllow.permission === 'allow',
      JSON.stringify(outAllow),
    );
    disableBootstrap(root);
    const outDeny = run(
      'gate.mjs',
      {
        ...base,
        hook_event_name: 'beforeShellExecution',
        command: 'node -e 1',
      },
      { CURSOR_GATE_CORE_PATH: brokenCore },
    );
    assert(
      'broken core without bootstrap denies',
      outDeny.permission === 'deny',
      JSON.stringify(outDeny),
    );
    assert(
      'broken core deny mentions error',
      String(outDeny.user_message || '').includes('core-boom'),
      JSON.stringify(outDeny),
    );

    const brokenImport = join(stateTmp, 'broken-import.mjs');
    writeFileSync(brokenImport, 'export async function handleGate() {\n');
    enableBootstrap(root);
    const outImportAllow = run(
      'gate.mjs',
      {
        ...base,
        hook_event_name: 'preToolUse',
        tool_name: 'Write',
        tool_input: { path: join(root, 'utils/foo.ts') },
      },
      { CURSOR_GATE_CORE_PATH: brokenImport },
    );
    assert(
      'broken import + bootstrap allows',
      outImportAllow.permission === 'allow',
      JSON.stringify(outImportAllow),
    );
    disableBootstrap(root);
  }

  // 18. track-phase: /bootstrap と /bootstrap off
  {
    const outOn = run('track.mjs', {
      ...base,
      hook_event_name: 'beforeSubmitPrompt',
      prompt: '/bootstrap harness rescue',
    });
    assert('track-phase bootstrap on', outOn.continue === true, JSON.stringify(outOn));
    assert('track-phase created marker', isBootstrapActive(root));
    const outOff = run('track.mjs', {
      ...base,
      hook_event_name: 'beforeSubmitPrompt',
      prompt: '/bootstrap off thanks',
    });
    assert('track-phase bootstrap off', outOff.continue === true, JSON.stringify(outOff));
    assert('track-phase removed marker', !isBootstrapActive(root));
  }

  // 19. sessionEnd でマーカー削除
  {
    enableBootstrap(root);
    run('session-end.mjs', { ...base });
    assert('sessionEnd removes bootstrap marker', !isBootstrapActive(root));
  }
}

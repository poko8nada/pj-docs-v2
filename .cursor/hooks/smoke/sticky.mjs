/** smoke: sticky */

/** @param {import('./_harness.mjs').SmokeCtx} smoke */
export function runTranscriptFallback(smoke) {
  // transcript_path sticky fallback (15)
  const {
    root,
    stateTmp,
    smokeTmpRoot,
    run,
    assert,
    clearSticky,
    formatJstIso,
    idFromTranscriptPath,
    writeFileSync,
    join,
  } = smoke;
  // 15. transcript_path のみでも gate が chore state を読める（sticky 無しのフォールバック）
  {
    clearSticky();
    const transcriptId = 'aaaaaaaa-bbbb-4ccc-dddd-eeeeeeeeeeee';
    const transcriptPath = join(
      smokeTmpRoot,
      'agent-transcripts',
      transcriptId,
      `${transcriptId}.jsonl`,
    );
    assert(
      'idFromTranscriptPath parses uuid',
      idFromTranscriptPath(transcriptPath) === transcriptId,
      transcriptPath,
    );

    writeFileSync(
      join(stateTmp, `20260716-120000+0900__${transcriptId}.json`),
      JSON.stringify(
        {
          phase: 'chore',
          unlock: { rules: true, issue: null, scope: true },
          updatedAt: formatJstIso(),
        },
        null,
        2,
      ) + '\n',
    );

    const out = run('gate.mjs', {
      workspace_roots: [root],
      cwd: root,
      transcript_path: transcriptPath,
      hook_event_name: 'beforeShellExecution',
      command: 'node -e 1',
    });
    assert('transcript_path unlocks shell', out.permission === 'allow', JSON.stringify(out));
  }
}

/** @param {import('./_harness.mjs').SmokeCtx} smoke */
export function runStickyContamination(smoke) {
  // sticky 汚染に勝つ統合 (旧20)
  const {
    root,
    smokeTmpRoot,
    run,
    assert,
    clearSticky,
    loadState,
    readLastPromptId,
    unlinkSync,
    join,
  } = smoke;
  // 20. 統合: sticky（発話 ID）が汚染 payload より勝つ
  {
    clearSticky();
    const realId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
    const staleId = 'f15fcdeb-7a9c-44e2-9035-f7c6c7c39fb1';
    const withId = { conversation_id: realId, workspace_roots: [root], cwd: root };
    const noId = { workspace_roots: [root], cwd: root };
    const contaminated = {
      conversation_id: staleId,
      session_id: staleId,
      workspace_roots: [root],
      cwd: root,
      transcript_path: join(smokeTmpRoot, 'agent-transcripts', staleId, `${staleId}.jsonl`),
    };
    const rulesPath = join(root, '.cursor/skills/rules/SKILL.md');
    const scopePath = join(root, '.cursor/skills/scope/SKILL.md');
    const probePath = join(root, '.cursor/hooks/_integration-probe.txt');

    run('track.mjs', {
      ...noId,
      hook_event_name: 'preToolUse',
      tool_name: 'ReadFile',
      tool_input: { path: rulesPath },
    });
    assert(
      'integration without sticky stays locked',
      loadState(root, realId).unlock.rules !== true,
      JSON.stringify(loadState(root, realId)),
    );

    run('track.mjs', {
      ...withId,
      hook_event_name: 'beforeSubmitPrompt',
      prompt: '/chore integration',
    });
    let st = loadState(root, realId);
    assert(
      'integration starts chore locked',
      st.phase === 'chore' && st.unlock.rules === false,
      JSON.stringify(st),
    );
    assert(
      'integration sticky written',
      readLastPromptId(root) === realId,
      String(readLastPromptId(root)),
    );

    run('track.mjs', {
      ...noId,
      hook_event_name: 'preToolUse',
      tool_name: 'ReadFile',
      tool_input: { path: scopePath },
    });
    run('track.mjs', {
      ...noId,
      hook_event_name: 'preToolUse',
      tool_name: 'ReadFile',
      tool_input: { path: rulesPath },
    });
    st = loadState(root, realId);
    assert(
      'integration sticky unlocks without payload id',
      st.unlock.rules === true && st.unlock.scope === true,
      JSON.stringify(st),
    );

    // 再ロックして汚染 payload でも sticky で解禁できることを見る
    run('track.mjs', {
      ...withId,
      hook_event_name: 'beforeSubmitPrompt',
      prompt: '/chore again',
    });
    assert(
      'integration re-entry locks',
      loadState(root, realId).unlock.rules === false,
      JSON.stringify(loadState(root, realId)),
    );

    run('track.mjs', {
      ...contaminated,
      hook_event_name: 'preToolUse',
      tool_name: 'ReadFile',
      tool_input: { path: rulesPath },
    });
    st = loadState(root, realId);
    assert(
      'integration sticky wins over contaminated transcript',
      st.unlock.rules === true,
      JSON.stringify(st),
    );
    assert(
      'integration stale id state untouched',
      loadState(root, staleId).unlock.rules !== true,
      JSON.stringify(loadState(root, staleId)),
    );

    const outWrite = run('gate.mjs', {
      ...contaminated,
      hook_event_name: 'preToolUse',
      tool_name: 'Write',
      tool_input: { path: probePath },
    });
    assert('integration Write allow', outWrite.permission === 'allow', JSON.stringify(outWrite));
    try {
      unlinkSync(probePath);
    } catch {
      // 無ければ無視
    }
  }
}

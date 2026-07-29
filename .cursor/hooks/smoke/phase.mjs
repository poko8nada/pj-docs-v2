/** smoke: phase */

/** @param {import('./_harness.mjs').SmokeCtx} smoke */
export function runPhaseCore(smoke) {
  // sessionStart〜phase switch / re-entry (0–10)
  const {
    root,
    id,
    base,
    run,
    assert,
    trackReadTsRef,
    trackReadIssueSkill,
    trackReadScope,
    trackReadAgenda,
    trackReadBuildTemplate,
    stateAbs,
    readState,
    findStateFileName,
    formatJstIso,
    loadState,
    onSessionStart,
    unlinkSync,
    writeFileSync,
    join,
    workspaceRoot,
  } = smoke;
  // lib/ 移動後も payload 無しの root fallback がリポジトリ根を指すこと
  assert(
    'workspaceRoot fallback is repo root',
    workspaceRoot({}) === root,
    String(workspaceRoot({})),
  );
  // 0. sessionStart はファイルを作らない。初回発話で discussion を実体化。
  {
    onSessionStart(root);
    assert('sessionStart creates no file', findStateFileName(root, id) === null);
    const outInject = run('inject-context.mjs', { ...base, is_background_agent: false });
    const ctx0 = outInject.additional_context || '';
    assert('inject does not export gate env', outInject.env == null, JSON.stringify(outInject));
    assert(
      'inject hints glob path',
      ctx0.includes(`*__${id}.json`),
      ctx0.includes('hooks/state') ? 'glob missing' : 'no gate section',
    );
    assert(
      'inject includes shell cwd rule',
      ctx0.includes('Shell cwd') && ctx0.includes('git -C'),
      'shell section missing',
    );
    assert(
      'inject includes shell chain guidance',
      ctx0.includes('one logical action') && ctx0.includes('unrelated steps'),
      'shell chain guidance missing',
    );
    assert(
      'inject includes web tools',
      ctx0.includes('Web tools') && ctx0.includes('web_search_exa') && ctx0.includes('WebFetch'),
      'web section missing',
    );
    assert(
      'inject includes pre-commit review',
      ctx0.includes('Gate rules') && ctx0.includes('/pre-commit-reviewer'),
      'gate rules / review hint missing',
    );
    assert(
      'inject includes discussion skill body last',
      ctx0.includes('discussion (default phase)') &&
        ctx0.includes('Agree **this session') &&
        ctx0.lastIndexOf('discussion (default phase)') > ctx0.lastIndexOf('Gate state'),
      'discussion section missing or not after gate',
    );
    assert('inject still no file', findStateFileName(root, id) === null);

    const outGate = run('gate.mjs', {
      ...base,
      hook_event_name: 'preToolUse',
      tool_name: 'Write',
      tool_input: { path: join(root, 'utils/foo.ts') },
    });
    assert('gate deny without state file', outGate.permission === 'deny', JSON.stringify(outGate));
    assert('gate does not create file', findStateFileName(root, id) === null);

    run('track.mjs', {
      ...base,
      hook_event_name: 'beforeSubmitPrompt',
      prompt: 'hello, just discussing',
    });
    const name = findStateFileName(root, id);
    assert(
      'first prompt creates JST-dated file',
      Boolean(name && /^\d{8}-\d{6}\+0900__test-conversation\.json$/.test(name)),
      name,
    );
    const st = readState();
    assert(
      'first prompt is discussion',
      st.phase === 'discussion' && st.unlock.rules === null,
      JSON.stringify(st),
    );
    assert('updatedAt is JST offset', st.updatedAt.endsWith('+09:00'), st.updatedAt);
  }

  // 1. locked Write deny
  {
    const out = run('gate.mjs', {
      ...base,
      hook_event_name: 'preToolUse',
      tool_name: 'Write',
      tool_input: { path: join(root, 'utils/foo.ts') },
    });
    assert('locked Write deny', out.permission === 'deny', JSON.stringify(out));
  }

  // 2. root md allow while locked
  {
    const out = run('gate.mjs', {
      ...base,
      hook_event_name: 'preToolUse',
      tool_name: 'Write',
      tool_input: { path: join(root, 'README.md') },
    });
    assert('locked root md allow', out.permission === 'allow', JSON.stringify(out));
  }

  // 3. locked nested md deny
  {
    const out = run('gate.mjs', {
      ...base,
      hook_event_name: 'preToolUse',
      tool_name: 'Write',
      tool_input: { path: join(root, 'docs/notes.md') },
    });
    assert('locked nested md deny', out.permission === 'deny', JSON.stringify(out));
  }

  // 4. discussion: gh/git read allow, write deny
  {
    const outList = run('gate.mjs', {
      ...base,
      hook_event_name: 'beforeShellExecution',
      command: 'gh issue list',
    });
    assert(
      'discussion gh issue list allow',
      outList.permission === 'allow',
      JSON.stringify(outList),
    );

    const outCreate = run('gate.mjs', {
      ...base,
      hook_event_name: 'beforeShellExecution',
      command: 'gh issue create --title t --body b',
    });
    assert(
      'discussion gh issue create deny',
      outCreate.permission === 'deny',
      JSON.stringify(outCreate),
    );

    const outStatus = run('gate.mjs', {
      ...base,
      hook_event_name: 'beforeShellExecution',
      command: 'git status',
    });
    assert(
      'discussion git status allow',
      outStatus.permission === 'allow',
      JSON.stringify(outStatus),
    );

    const outCommit = run('gate.mjs', {
      ...base,
      hook_event_name: 'beforeShellExecution',
      command: 'git commit -m msg',
    });
    assert(
      'discussion git commit deny',
      outCommit.permission === 'deny',
      JSON.stringify(outCommit),
    );
  }

  // 5. pnpm deny while locked
  {
    const out = run('gate.mjs', {
      ...base,
      hook_event_name: 'beforeShellExecution',
      command: 'pnpm test:run',
    });
    assert('locked pnpm deny', out.permission === 'deny', JSON.stringify(out));
  }

  // 5b. set-label: セグメント単位で常時 allow。他セグメントが deny なら全体 deny
  {
    const out = run('gate.mjs', {
      ...base,
      hook_event_name: 'beforeShellExecution',
      command: 'node .cursor/skills/scope/scripts/set-label.mjs topic-a',
    });
    assert('locked set-label allow', out.permission === 'allow', JSON.stringify(out));

    const outWithReadonly = run('gate.mjs', {
      ...base,
      hook_event_name: 'beforeShellExecution',
      command: 'node .cursor/skills/scope/scripts/set-label.mjs topic-a && git status',
    });
    assert(
      'locked set-label + readonly allow',
      outWithReadonly.permission === 'allow',
      JSON.stringify(outWithReadonly),
    );

    const outChain = run('gate.mjs', {
      ...base,
      hook_event_name: 'beforeShellExecution',
      command: 'node .cursor/skills/scope/scripts/set-label.mjs topic-a && pnpm test:run',
    });
    assert('locked set-label chain deny', outChain.permission === 'deny', JSON.stringify(outChain));

    const outBg = run('gate.mjs', {
      ...base,
      hook_event_name: 'beforeShellExecution',
      command: 'node .cursor/skills/scope/scripts/set-label.mjs topic-a & pnpm test:run',
    });
    assert('locked set-label bg deny', outBg.permission === 'deny', JSON.stringify(outBg));

    const outNl = run('gate.mjs', {
      ...base,
      hook_event_name: 'beforeShellExecution',
      command: 'node .cursor/skills/scope/scripts/set-label.mjs topic-a\npnpm test:run',
    });
    assert(
      'locked set-label newline then pnpm deny',
      outNl.permission === 'deny',
      JSON.stringify(outNl),
    );
  }

  // 6. track phase — 既存 discussion を work に更新（新規ファイルは増やさない）
  {
    const nameBefore = findStateFileName(root, id);
    const out = run('track.mjs', {
      ...base,
      hook_event_name: 'beforeSubmitPrompt',
      prompt: '/work go',
    });
    assert('track-phase continue', out.continue === true, JSON.stringify(out));
    assert(
      'same file after phase',
      findStateFileName(root, id) === nameBefore,
      findStateFileName(root, id),
    );
    const st = readState();
    assert(
      'phase is work',
      st.phase === 'work' &&
        st.unlock.rules === false &&
        st.unlock.issue === false &&
        st.unlock.agenda === false &&
        st.unlock.issueTemplate === undefined,
      JSON.stringify(st),
    );
  }

  // 7. still deny Write after phase only — scope before rules; gh issue write needs handshake; git writes unlock
  {
    const out = run('gate.mjs', {
      ...base,
      hook_event_name: 'preToolUse',
      tool_name: 'Write',
      tool_input: { path: join(root, 'utils/foo.ts') },
    });
    assert(
      'phase-only Write deny is gate-scope',
      out.permission === 'deny' && String(out.agent_message).includes('[gate-scope]'),
      JSON.stringify(out),
    );

    const outPnpmInstall = run('gate.mjs', {
      ...base,
      hook_event_name: 'beforeShellExecution',
      command: 'pnpm install',
    });
    assert(
      'phase-only pnpm install deny is gate-scope',
      outPnpmInstall.permission === 'deny' &&
        String(outPnpmInstall.agent_message).includes('[gate-scope]'),
      JSON.stringify(outPnpmInstall),
    );

    trackReadScope(base);
    assert(
      'scope Read opens scope',
      loadState(root, id).unlock.scope === true,
      JSON.stringify(loadState(root, id)),
    );

    const outAfterScope = run('gate.mjs', {
      ...base,
      hook_event_name: 'preToolUse',
      tool_name: 'Write',
      tool_input: { path: join(root, 'utils/foo.ts') },
    });
    assert(
      'scope open Write deny is gate-agenda',
      outAfterScope.permission === 'deny' &&
        String(outAfterScope.agent_message).includes('[gate-agenda]') &&
        !String(outAfterScope.agent_message).includes('[gate-scope]'),
      JSON.stringify(outAfterScope),
    );

    const outPnpmInstallAgenda = run('gate.mjs', {
      ...base,
      hook_event_name: 'beforeShellExecution',
      command: 'pnpm install',
    });
    assert(
      'scope open pnpm install deny is gate-agenda',
      outPnpmInstallAgenda.permission === 'deny' &&
        String(outPnpmInstallAgenda.agent_message).includes('[gate-agenda]'),
      JSON.stringify(outPnpmInstallAgenda),
    );

    trackReadAgenda(base);
    assert(
      'agenda Read opens unlock.agenda',
      loadState(root, id).unlock.agenda === true,
      JSON.stringify(loadState(root, id)),
    );

    const outAfterAgenda = run('gate.mjs', {
      ...base,
      hook_event_name: 'preToolUse',
      tool_name: 'Write',
      tool_input: { path: join(root, 'utils/foo.ts') },
    });
    assert(
      'agenda open still denies Write without rules',
      outAfterAgenda.permission === 'deny' &&
        String(outAfterAgenda.agent_message).includes('rules≠true') &&
        !String(outAfterAgenda.agent_message).includes('[gate-agenda]'),
      JSON.stringify(outAfterAgenda),
    );

    const outGhList = run('gate.mjs', {
      ...base,
      hook_event_name: 'beforeShellExecution',
      command: 'gh issue list',
    });
    assert(
      'work gh issue list allow before handshake',
      outGhList.permission === 'allow',
      JSON.stringify(outGhList),
    );

    const outGh = run('gate.mjs', {
      ...base,
      hook_event_name: 'beforeShellExecution',
      command: 'gh issue create --title t --body b',
    });
    assert(
      'work gh issue create deny before handshake',
      outGh.permission === 'deny' && String(outGh.agent_message).includes('[gate-issue]'),
      JSON.stringify(outGh),
    );

    const outGit = run('gate.mjs', {
      ...base,
      hook_event_name: 'beforeShellExecution',
      command: 'git commit -m msg',
    });
    assert('phase unlocks git write', outGit.permission === 'allow', JSON.stringify(outGit));

    const outPnpm = run('gate.mjs', {
      ...base,
      hook_event_name: 'beforeShellExecution',
      command: 'pnpm test:run',
    });
    assert('phase-only pnpm test allow', outPnpm.permission === 'allow', JSON.stringify(outPnpm));

    const outPnpmInstallRules = run('gate.mjs', {
      ...base,
      hook_event_name: 'beforeShellExecution',
      command: 'pnpm install',
    });
    assert(
      'agenda open pnpm install deny is rules',
      outPnpmInstallRules.permission === 'deny' &&
        String(outPnpmInstallRules.agent_message).includes('rules≠true'),
      JSON.stringify(outPnpmInstallRules),
    );
  }

  // 7b. issue handshake — skill Read, template Read, then gh issue write
  {
    trackReadIssueSkill(base);
    assert(
      'issue skill read sets issue true',
      loadState(root, id).unlock.issue === true,
      JSON.stringify(loadState(root, id)),
    );
    assert(
      'issue skill recorded in read.skills',
      loadState(root, id).read.skills?.includes('issue'),
      JSON.stringify(loadState(root, id)),
    );

    const outGhPartial = run('gate.mjs', {
      ...base,
      hook_event_name: 'beforeShellExecution',
      command: 'gh issue create --title t --body b',
    });
    assert(
      'gh issue create deny before template',
      outGhPartial.permission === 'deny' && String(outGhPartial.agent_message).includes('template'),
      JSON.stringify(outGhPartial),
    );

    trackReadBuildTemplate(base);
    const stReady = loadState(root, id);
    assert(
      'issue handshake complete',
      stReady.unlock.issue === true &&
        Array.isArray(stReady.read.refs) &&
        stReady.read.refs.includes('issue/build-template.md'),
      JSON.stringify(stReady),
    );

    const outGhReady = run('gate.mjs', {
      ...base,
      hook_event_name: 'beforeShellExecution',
      command: 'gh issue create --title t --body b',
    });
    assert(
      'gh issue create allow after handshake',
      outGhReady.permission === 'allow',
      JSON.stringify(outGhReady),
    );
  }

  // 8. discussion 中の rules スキル実行はフラグを立てない／Write 不可
  {
    run('track.mjs', {
      ...base,
      hook_event_name: 'beforeSubmitPrompt',
      prompt: '/discussion step back',
    });
    const out = run('track.mjs', {
      ...base,
      hook_event_name: 'beforeReadFile',
      file_path: join(root, '.cursor/skills/rules/SKILL.md'),
    });
    assert('discussion rules-read allow file', out.permission === 'allow', JSON.stringify(out));
    const st = readState();
    assert(
      'discussion rules stays null',
      st.phase === 'discussion' && st.unlock.rules === null,
      JSON.stringify(st),
    );
    assert('discussion closes scope', st.unlock.scope === false, JSON.stringify(st));
    const out2 = run('gate.mjs', {
      ...base,
      hook_event_name: 'preToolUse',
      tool_name: 'Write',
      tool_input: { path: join(root, 'utils/foo.ts') },
    });
    assert('discussion Write still deny', out2.permission === 'deny', JSON.stringify(out2));

    const outGh = run('gate.mjs', {
      ...base,
      hook_event_name: 'beforeShellExecution',
      command: 'gh issue create --title t --body b',
    });
    assert(
      'discussion after /discussion denies gh write',
      outGh.permission === 'deny',
      JSON.stringify(outGh),
    );
  }

  // 8a. 旧 state（discussion + false）は読み込み時に null へ正規化
  {
    writeFileSync(
      stateAbs(),
      JSON.stringify({ phase: 'discussion', implement: false, updatedAt: formatJstIso() }, null, 2),
    );
    const st = loadState(root, id);
    assert(
      'legacy discussion false normalizes to null',
      st.phase === 'discussion' && st.unlock.rules === null,
      JSON.stringify(st),
    );
  }

  // 8b. work のあと scope + agenda + rules スキル実行で解禁
  {
    run('track.mjs', { ...base, hook_event_name: 'beforeSubmitPrompt', prompt: '/work go' });
    trackReadScope(base);
    trackReadAgenda(base);
    const out = run('track.mjs', {
      ...base,
      hook_event_name: 'beforeReadFile',
      file_path: join(root, '.cursor/skills/rules/SKILL.md'),
    });
    assert('work track-rules allow', out.permission === 'allow', JSON.stringify(out));
    const denyNoRef = run('gate.mjs', {
      ...base,
      hook_event_name: 'preToolUse',
      tool_name: 'Write',
      tool_input: { path: join(root, 'utils/foo.ts') },
    });
    assert(
      'unlocked Write without rules ref deny',
      denyNoRef.permission === 'deny' &&
        String(denyNoRef.agent_message ?? '').includes('rules/references'),
      JSON.stringify(denyNoRef),
    );
    trackReadTsRef(base);
    const out2 = run('gate.mjs', {
      ...base,
      hook_event_name: 'preToolUse',
      tool_name: 'Write',
      tool_input: { path: join(root, 'utils/foo.ts') },
    });
    assert('unlocked Write allow', out2.permission === 'allow', JSON.stringify(out2));
  }

  // 9. unlocked でも state 編集は deny
  {
    const out = run('gate.mjs', {
      ...base,
      hook_event_name: 'preToolUse',
      tool_name: 'Write',
      tool_input: { path: stateAbs() },
    });
    assert('state Write always deny', out.permission === 'deny', JSON.stringify(out));
  }

  // 9b. ls …/state/ 2>/dev/null は allow（> の誤検知防止）
  {
    const out = run('gate.mjs', {
      ...base,
      hook_event_name: 'beforeShellExecution',
      command: 'ls .cursor/hooks/state/ 2>/dev/null',
    });
    assert('ls state with 2>/dev/null allow', out.permission === 'allow', JSON.stringify(out));
  }

  // 9c. state へリダイレクトは deny
  {
    const out = run('gate.mjs', {
      ...base,
      hook_event_name: 'beforeShellExecution',
      command: 'echo x > .cursor/hooks/state/evil.json',
    });
    assert('redirect into state deny', out.permission === 'deny', JSON.stringify(out));
  }

  // 10. phase switch / re-entry resets rules + readRefs
  {
    trackReadTsRef(base);
    assert(
      'read.refs records rules/shared.md',
      loadState(root, id).read.refs?.includes('rules/shared.md'),
      JSON.stringify(loadState(root, id)),
    );
    run('track.mjs', { ...base, hook_event_name: 'beforeSubmitPrompt', prompt: '/chore typo' });
    const st = readState();
    assert(
      'phase switch resets rules and read',
      st.phase === 'chore' &&
        st.unlock.rules === false &&
        st.unlock.scope === true &&
        Array.isArray(st.read.refs) &&
        st.read.refs.length === 0 &&
        Array.isArray(st.read.skills) &&
        st.read.skills.length === 0,
      JSON.stringify(st),
    );

    trackReadScope(base);
    run('track.mjs', {
      ...base,
      hook_event_name: 'beforeReadFile',
      file_path: join(root, '.cursor/skills/rules/SKILL.md'),
    });
    trackReadTsRef(base);
    assert(
      'chore unlock + ref before re-entry',
      loadState(root, id).unlock.rules === true &&
        loadState(root, id).unlock.scope === true &&
        loadState(root, id).read.refs?.includes('rules/shared.md') &&
        loadState(root, id).read.skills?.includes('rules'),
      JSON.stringify(loadState(root, id)),
    );
    run('track.mjs', {
      ...base,
      hook_event_name: 'beforeSubmitPrompt',
      prompt: '/chore again',
    });
    const stRe = readState();
    assert(
      'same-phase re-entry resets rules and read, keeps scope',
      stRe.phase === 'chore' &&
        stRe.unlock.rules === false &&
        stRe.unlock.scope === true &&
        Array.isArray(stRe.read.refs) &&
        stRe.read.refs.length === 0 &&
        Array.isArray(stRe.read.skills) &&
        stRe.read.skills.length === 0,
      JSON.stringify(stRe),
    );
  }

  // 10b. review.files はフェーズ変更でも残る
  {
    const persistId = 'review-persist-id';
    const persistBase = { conversation_id: persistId, workspace_roots: [root], cwd: root };
    run('track.mjs', {
      ...persistBase,
      hook_event_name: 'beforeSubmitPrompt',
      prompt: '/chore review persist',
    });
    run('track.mjs', {
      ...persistBase,
      hook_event_name: 'preToolUse',
      tool_name: 'ReadFile',
      tool_input: { path: join(root, '.cursor/skills/scope/SKILL.md') },
    });
    run('track.mjs', {
      ...persistBase,
      hook_event_name: 'preToolUse',
      tool_name: 'ReadFile',
      tool_input: { path: join(root, '.cursor/skills/rules/SKILL.md') },
    });
    writeFileSync(join(root, 'utils/_review-persist-probe.ts'), 'export const persistProbe = 1;\n');
    trackReadTsRef(persistBase);
    run('track.mjs', {
      ...persistBase,
      hook_event_name: 'postToolUse',
      tool_name: 'Write',
      tool_input: { path: join(root, 'utils/_review-persist-probe.ts') },
    });
    assert(
      'review files before phase switch',
      loadState(root, persistId).review.files.includes('utils/_review-persist-probe.ts'),
      JSON.stringify(loadState(root, persistId)),
    );
    run('track.mjs', {
      ...persistBase,
      hook_event_name: 'beforeSubmitPrompt',
      prompt: '/work after review dirty',
    });
    const stPersist = loadState(root, persistId);
    assert(
      'review files persist across phase switch',
      stPersist.phase === 'work' &&
        stPersist.review.files.includes('utils/_review-persist-probe.ts') &&
        stPersist.read.refs.length === 0,
      JSON.stringify(stPersist),
    );
    run('track.mjs', {
      ...persistBase,
      hook_event_name: 'beforeSubmitPrompt',
      prompt: '/discussion clear phase',
    });
    assert(
      'review files persist into discussion',
      loadState(root, persistId).review.files.includes('utils/_review-persist-probe.ts'),
      JSON.stringify(loadState(root, persistId)),
    );
    try {
      unlinkSync(join(root, 'utils/_review-persist-probe.ts'));
    } catch {
      // 無ければ無視
    }
  }
}

/** @param {import('./_harness.mjs').SmokeCtx} smoke */
export function runResumeTtl(smoke) {
  // resume + TTL (11–12)
  const {
    root,
    stateTmp,
    id,
    assert,
    stateAbs,
    findStateFileName,
    formatJstIso,
    loadState,
    onSessionStart,
    purgeStaleStates,
    STATE_TTL_DAYS,
    existsSync,
    writeFileSync,
    join,
  } = smoke;
  // 11. resume: sessionStart 掃除だけでは phase を消さない / ファイル名は維持
  {
    const nameBefore = findStateFileName(root, id);
    writeFileSync(
      stateAbs(),
      JSON.stringify({ phase: 'work', implement: true, updatedAt: formatJstIso() }, null, 2),
    );
    onSessionStart(root);
    const st = loadState(root, id);
    assert(
      'resume keeps work+rules',
      st.phase === 'work' && st.unlock.rules === true,
      JSON.stringify(st),
    );
    assert(
      'resume keeps filename',
      findStateFileName(root, id) === nameBefore,
      findStateFileName(root, id),
    );
  }

  // 12. TTL: 古いファイルを消す
  {
    const oldId = 'old-conversation';
    const oldName = `20200101-000000+0900__${oldId}.json`;
    const oldPath = join(stateTmp, oldName);
    const oldDate = new Date(Date.now() - (STATE_TTL_DAYS + 1) * 24 * 60 * 60 * 1000);
    writeFileSync(
      oldPath,
      JSON.stringify(
        { phase: 'discussion', implement: null, updatedAt: formatJstIso(oldDate) },
        null,
        2,
      ),
    );
    const removed = purgeStaleStates(root);
    assert(
      'TTL removed old file',
      removed >= 1 && existsSync(oldPath) === false,
      `removed=${removed}`,
    );
    assert('TTL kept fresh file', Boolean(findStateFileName(root, id)));
  }
}

/** @param {import('./_harness.mjs').SmokeCtx} smoke */
export function runRulesUnlock(smoke) {
  // preToolUse Read で rules 解禁 (16)
  const {
    root,
    stateTmp,
    smokeTmpRoot,
    base,
    run,
    assert,
    clearSticky,
    findStateFileName,
    formatJstIso,
    loadState,
    writeFileSync,
    join,
  } = smoke;
  // 16. preToolUse Read（tool_input.path）で rules 解禁
  {
    const readId = 'pretooluse-read-id';
    const readBase = { conversation_id: readId, workspace_roots: [root], cwd: root };
    run('track.mjs', { ...readBase, hook_event_name: 'beforeSubmitPrompt', prompt: '/work go' });
    const out = run('track.mjs', {
      ...readBase,
      hook_event_name: 'preToolUse',
      tool_name: 'Read',
      tool_input: { path: join(root, '.cursor/skills/rules/SKILL.md') },
    });
    assert('preToolUse Read track-rules allow', out.permission === 'allow', JSON.stringify(out));
    const st = loadState(root, readId);
    assert(
      'preToolUse Read sets rules true',
      st.phase === 'work' && st.unlock.rules === true,
      JSON.stringify(st),
    );
  }

  // 16b. preToolUse ReadFile（Cursor 内部名）で rules 解禁
  {
    const readId = 'pretooluse-readfile-id';
    const readBase = { conversation_id: readId, workspace_roots: [root], cwd: root };
    run('track.mjs', { ...readBase, hook_event_name: 'beforeSubmitPrompt', prompt: '/chore go' });
    run('track.mjs', {
      ...readBase,
      hook_event_name: 'preToolUse',
      tool_name: 'ReadFile',
      tool_input: { path: join(root, '.cursor/skills/rules/SKILL.md') },
    });
    const st = loadState(root, readId);
    assert(
      'preToolUse ReadFile sets rules true',
      st.phase === 'chore' && st.unlock.rules === true,
      JSON.stringify(st),
    );
  }

  // 16c. CURSOR_TRANSCRIPT_PATH で conversation_id を補完（gate env は使わない）
  {
    clearSticky();
    const envId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
    const prev = process.env.CURSOR_TRANSCRIPT_PATH;
    process.env.CURSOR_TRANSCRIPT_PATH = join(
      smokeTmpRoot,
      'agent-transcripts',
      envId,
      `${envId}.jsonl`,
    );
    try {
      writeFileSync(
        join(stateTmp, `20260716-130000+0900__${envId}.json`),
        JSON.stringify({ phase: 'chore', implement: false, updatedAt: formatJstIso() }, null, 2) +
          '\n',
      );
      run('track.mjs', {
        workspace_roots: [root],
        cwd: root,
        hook_event_name: 'preToolUse',
        tool_name: 'ReadFile',
        tool_input: { path: join(root, '.cursor/skills/rules/SKILL.md') },
      });
      const st = loadState(root, envId);
      assert(
        'CURSOR_TRANSCRIPT_PATH unlocks rules',
        st.phase === 'chore' && st.unlock.rules === true,
        JSON.stringify(st),
      );
    } finally {
      if (prev === undefined) delete process.env.CURSOR_TRANSCRIPT_PATH;
      else process.env.CURSOR_TRANSCRIPT_PATH = prev;
    }
  }

  // 16d. unknown では /chore しても state を作らない
  {
    run('track.mjs', {
      workspace_roots: [root],
      cwd: root,
      hook_event_name: 'beforeSubmitPrompt',
      prompt: '/chore no-id',
    });
    assert('unknown creates no state file', findStateFileName(root, 'unknown') === null);
  }

  // 16e. locked でも Read は allow（解錠は track、ロックは編集のみ）
  {
    const outRead = run('gate.mjs', {
      ...base,
      hook_event_name: 'preToolUse',
      tool_name: 'Read',
      tool_input: { path: join(root, 'utils/foo.ts') },
    });
    assert('locked Read allow', outRead.permission === 'allow', JSON.stringify(outRead));
  }
}

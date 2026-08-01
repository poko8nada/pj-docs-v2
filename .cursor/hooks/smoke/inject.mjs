/** smoke: inject */

/** @param {import('./_harness.mjs').SmokeCtx} smoke */
export function runInjectGateListing(smoke) {
  // inject Gate rules + dir sort
  const { root, stateTmp, id, base, run, assert, findStateFileName, readdirSync } = smoke;
  // inject は Shell / Web / Gate rules のみ（ライブ Gate state なし）
  {
    const out = run('inject-context.mjs', { ...base, is_background_agent: false });
    const ctx = out.additional_context || '';
    assert('inject mentions Gate rules', ctx.includes('Gate rules'), ctx.slice(0, 200));
    assert(
      'inject includes Special rules',
      ctx.includes('Special rules') && ctx.includes('## Shell') && ctx.includes('## Web'),
      ctx.slice(0, 400),
    );
    assert(
      'inject includes shell cwd rule',
      ctx.includes('workspace root') && ctx.includes('git -C'),
      ctx.slice(0, 400),
    );
    assert(
      'inject includes web tools',
      ctx.includes('web_search_exa') && ctx.includes('WebFetch') && ctx.includes('Context7'),
      ctx.slice(0, 400),
    );
    assert(
      'inject Gate rules has Phase heading',
      ctx.includes('## Phase') && ctx.includes('unlock.scope'),
      ctx.slice(0, 600),
    );
    assert(
      'inject Gate rules has Edits heading',
      ctx.includes('## Edits') && ctx.includes('unlock.agenda'),
      ctx.slice(0, 600),
    );
    assert(
      'inject states discussion is read-only',
      ctx.includes('discussion` is read-only'),
      ctx.slice(0, 600),
    );
    assert(
      'inject mentions refs gate',
      ctx.includes('## References') && ctx.includes('read.refs') && ctx.includes('skill/name.md'),
      ctx.slice(0, 600),
    );
    assert(
      'inject mentions review',
      ctx.includes('## Review') && ctx.includes('/pre-commit-reviewer'),
      ctx.slice(0, 600),
    );
    assert(
      'inject mentions state file naming',
      ctx.includes('+0900__') && ctx.includes('<conversation_id>'),
      ctx.slice(0, 600),
    );
    assert('inject has no Current values', !ctx.includes('Current values:'), ctx.slice(0, 400));
    assert('inject has no Gate state section', !ctx.includes('Gate state'), ctx.slice(0, 400));
    assert('inject has no AGENTS dump', !ctx.includes('# AGENTS.md'), ctx.slice(0, 400));
    assert(
      'inject has no discussion skill dump',
      !ctx.includes('discussion (default phase)'),
      ctx.slice(0, 400),
    );
    // sessionStart は state を作らない（id は payload にあるがファイル未作成でもよい）
    void id;
    void findStateFileName;
    void root;
  }

  // ディレクトリ一覧が日付順（ファイル名ソート）
  {
    const names = readdirSync(stateTmp)
      .filter((n) => n.endsWith('.json'))
      .toSorted();
    assert(
      'sorted names are chronological prefix',
      names.every((n) => /^\d{8}-\d{6}\+0900__/.test(n)),
      names.join(','),
    );
  }
}

/** @param {import('./_harness.mjs').SmokeCtx} smoke */
export function runInjectSticky(smoke) {
  // sessionStart inject: sticky があってもライブ state は注入しない
  const {
    root,
    stateTmp,
    run,
    assert,
    clearSticky,
    formatJstIso,
    lastPromptIdPath,
    readLastPromptId,
    writeFileSync,
    join,
  } = smoke;
  {
    clearSticky();
    const prevId = 'stickyprv-0000-4000-8000-000000000001';
    const newId = 'stickynew-0000-4000-8000-000000000002';
    writeFileSync(
      join(stateTmp, `20260719-120000+0900__${prevId}.json`),
      JSON.stringify(
        {
          phase: 'chore',
          unlock: { rules: true, issue: null, agenda: null, scope: false },
          review: { files: [], dirtyAt: null },
          check: { pending: [] },
          read: { skills: [], refs: [] },
          label: 'prev',
          updatedAt: formatJstIso(),
        },
        null,
        2,
      ),
    );
    writeFileSync(
      join(stateTmp, `20260719-120001+0900__${newId}.json`),
      JSON.stringify(
        {
          phase: 'discussion',
          unlock: { rules: null, issue: null, agenda: null, scope: false },
          review: { files: [], dirtyAt: null },
          check: { pending: [] },
          read: { skills: [], refs: [] },
          label: 'new',
          updatedAt: formatJstIso(),
        },
        null,
        2,
      ),
    );
    // 前会話を sticky に残す
    writeFileSync(
      lastPromptIdPath(root),
      `${JSON.stringify({ id: prevId, updatedAt: formatJstIso() }, null, 2)}\n`,
    );

    const out = run('inject-context.mjs', {
      conversation_id: newId,
      session_id: newId,
      workspace_roots: [root],
      cwd: root,
      hook_event_name: 'sessionStart',
      is_background_agent: false,
    });
    const ctx = out.additional_context || '';
    assert(
      'inject still returns slim context',
      ctx.includes('Gate rules') && ctx.includes('Special rules') && ctx.includes('## Shell'),
      ctx.slice(0, 600),
    );
    assert(
      'inject does not dump sticky conversation state',
      !ctx.includes('label: prev') && !ctx.includes('label: new') && !ctx.includes('phase: chore'),
      ctx.slice(0, 600),
    );
    assert(
      'inject does not steal sticky from previous conversation',
      readLastPromptId(root) === prevId,
      String(readLastPromptId(root)),
    );

    // sticky 更新はユーザー発話のみ
    run('track.mjs', {
      conversation_id: newId,
      session_id: newId,
      workspace_roots: [root],
      cwd: root,
      hook_event_name: 'beforeSubmitPrompt',
      prompt: 'hello new conversation',
    });
    assert(
      'user utterance updates sticky to new id',
      readLastPromptId(root) === newId,
      String(readLastPromptId(root)),
    );
  }
}

/** smoke: inject */

/** @param {import('./_harness.mjs').SmokeCtx} smoke */
export function runInjectGateListing(smoke) {
  // inject Gate state + dir sort (13–14)
  const { root, stateTmp, id, base, run, assert, findStateFileName, readdirSync } = smoke;
  // 13. inject が Gate state を含む（既存ファイルがあれば実名）
  {
    const out = run('inject-context.mjs', { ...base, is_background_agent: false });
    const ctx = out.additional_context || '';
    const name = findStateFileName(root, id);
    assert('inject mentions Gate state', ctx.includes('Gate state'), ctx.slice(0, 200));
    assert('inject includes live review.files', ctx.includes('review.files:'), ctx.slice(0, 400));
    assert('inject includes live read.skills', ctx.includes('read.skills:'), ctx.slice(0, 400));
    assert('inject includes live read.refs', ctx.includes('read.refs:'), ctx.slice(0, 400));
    assert(
      'inject includes live issue handshake',
      ctx.includes('unlock.issue:') && !ctx.includes('unlock.issueTemplate:'),
      ctx.slice(0, 400),
    );
    assert('inject includes live scope', ctx.includes('unlock.scope:'), ctx.slice(0, 400));
    assert(
      'inject mentions refs gate',
      ctx.includes('Gate rules') && ctx.includes('read.refs') && ctx.includes('skill/name.md'),
      ctx.slice(0, 400),
    );
    assert('inject mentions dated state path', Boolean(name && ctx.includes(name)), name);
    assert('inject mentions discussion', ctx.includes('discussion'), '');
    assert('inject mentions JST naming', ctx.includes('+0900'), '');
    assert('inject mentions rules null semantics', ctx.includes('`null`'), '');
  }

  // 14. ディレクトリ一覧が日付順（ファイル名ソート）
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
  // inject が sticky を盗まない (旧22)
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
  // 22. sessionStart inject: 前会話 sticky があっても payload の state を出す（sticky は触らない）
  {
    clearSticky();
    const prevId = 'stickyprv-0000-4000-8000-000000000001';
    const newId = 'stickynew-0000-4000-8000-000000000002';
    writeFileSync(
      join(stateTmp, `20260719-120000+0900__${prevId}.json`),
      JSON.stringify(
        {
          phase: 'chore',
          implement: true,
          issue: null,
          review: { files: [] },
          check: { pending: [] },
          readRefs: [],
          label: 'prev',
          updatedAt: formatJstIso(),
        },
        null,
        2,
      ) + '\n',
    );
    writeFileSync(
      join(stateTmp, `20260719-130000+0900__${newId}.json`),
      JSON.stringify(
        {
          phase: 'discussion',
          implement: null,
          issue: null,
          review: { files: [] },
          check: { pending: [] },
          readRefs: [],
          label: 'new',
          updatedAt: formatJstIso(),
        },
        null,
        2,
      ) + '\n',
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
      'inject prefers new conversation over sticky',
      ctx.includes(newId) && ctx.includes('phase: discussion') && ctx.includes('label: new'),
      ctx.slice(0, 600),
    );
    assert(
      'inject does not show previous sticky chore unlock',
      !ctx.includes('phase: chore') && !ctx.includes('label: prev'),
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

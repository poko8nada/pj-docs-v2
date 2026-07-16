#!/usr/bin/env node
/**
 * ゲート hooks のスモークテスト（Cursor 実行時なし）。
 * 使い方: node .cursor/hooks/_gate.smoke.mjs
 * 一時 state は `.cursor/hooks/.smoke-tmp/` に置き、終了時に削除する。
 */
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import {
  bootstrapMarkerPath,
  disableBootstrap,
  enableBootstrap,
  isBootstrapActive,
} from './_bootstrap.mjs';
import {
  findStateFileName,
  formatJstIso,
  GATE_CONVERSATION_ENV,
  idFromTranscriptPath,
  loadState,
  onSessionStart,
  PHASE_DISCUSSION,
  purgeStaleStates,
  STATE_TTL_DAYS,
} from './_state.mjs';

const hooksDir = fileURLToPath(new URL('.', import.meta.url));
const root = resolve(hooksDir, '../..');
const smokeTmpRoot = join(hooksDir, '.smoke-tmp');
mkdirSync(smokeTmpRoot, { recursive: true });
const stateTmp = mkdtempSync(join(smokeTmpRoot, 'state-'));
const id = 'test-conversation';

let failed = 0;

function run(script, payload, hookEnv = {}) {
  const r = spawnSync(process.execPath, [join(hooksDir, script)], {
    input: JSON.stringify(payload),
    encoding: 'utf8',
    env: {
      ...process.env,
      CURSOR_GATE_STATE_DIR: stateTmp,
      ...hookEnv,
    },
  });
  if (r.status !== 0) {
    throw new Error(`${script} exited ${r.status}: ${r.stderr}`);
  }
  const line = (r.stdout || '').trim().split('\n').filter(Boolean).pop() || '{}';
  return JSON.parse(line);
}

function assert(name, cond, detail = '') {
  if (cond) {
    process.stdout.write(`ok  - ${name}\n`);
  } else {
    failed += 1;
    process.stderr.write(`FAIL - ${name}${detail ? `: ${detail}` : ''}\n`);
  }
}

function stateAbs() {
  const name = findStateFileName(root, id);
  if (!name) throw new Error('state file missing');
  return join(stateTmp, name);
}

function readState() {
  return JSON.parse(readFileSync(stateAbs(), 'utf8'));
}

const base = {
  conversation_id: id,
  workspace_roots: [root],
  cwd: root,
};

process.env.CURSOR_GATE_STATE_DIR = stateTmp;
delete process.env.CURSOR_GATE_BOOTSTRAP;
disableBootstrap(root);

try {
  // 0. sessionStart はファイルを作らない。初回発話で discussion を実体化。
  {
    onSessionStart(root);
    assert('sessionStart creates no file', findStateFileName(root, id) === null);
    const outInject = run('inject-context.mjs', { ...base, is_background_agent: false });
    const ctx0 = outInject.additional_context || '';
    assert(
      'inject returns conversation env',
      outInject.env?.[GATE_CONVERSATION_ENV] === id,
      JSON.stringify(outInject),
    );
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
      'inject includes pre-commit review',
      ctx0.includes('Pre-commit review') && ctx0.includes('/pre-commit-reviewer'),
      'review section missing',
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

    run('track.mjs', { ...base, hook_event_name: 'beforeSubmitPrompt', prompt: 'hello, just discussing' });
    const name = findStateFileName(root, id);
    assert(
      'first prompt creates JST-dated file',
      Boolean(name && /^\d{8}-\d{6}\+0900__test-conversation\.json$/.test(name)),
      name,
    );
    const st = readState();
    assert(
      'first prompt is discussion',
      st.phase === 'discussion' && st.implement === null,
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

  // 6. track phase — 既存 discussion を forge に更新（新規ファイルは増やさない）
  {
    const nameBefore = findStateFileName(root, id);
    const out = run('track.mjs', {
      ...base,
      hook_event_name: 'beforeSubmitPrompt',
      prompt: '/forge lock plan',
    });
    assert('track-phase continue', out.continue === true, JSON.stringify(out));
    assert(
      'same file after phase',
      findStateFileName(root, id) === nameBefore,
      findStateFileName(root, id),
    );
    const st = readState();
    assert('phase is forge', st.phase === 'forge' && st.implement === false, JSON.stringify(st));
  }

  // 7. still deny Write after phase only — but gh/git writes unlock
  {
    const out = run('gate.mjs', {
      ...base,
      hook_event_name: 'preToolUse',
      tool_name: 'Write',
      tool_input: { path: join(root, 'utils/foo.ts') },
    });
    assert('phase-only Write deny', out.permission === 'deny', JSON.stringify(out));

    const outGh = run('gate.mjs', {
      ...base,
      hook_event_name: 'beforeShellExecution',
      command: 'gh issue create --title t --body b',
    });
    assert('phase unlocks gh write', outGh.permission === 'allow', JSON.stringify(outGh));

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
    assert('phase-only pnpm still deny', outPnpm.permission === 'deny', JSON.stringify(outPnpm));
  }

  // 8. discussion 中の implement Read はフラグを立てない／Write 不可
  {
    run('track.mjs', { ...base, hook_event_name: 'beforeSubmitPrompt', prompt: '/discussion step back' });
    const out = run('track.mjs', {
      ...base,
      hook_event_name: 'beforeReadFile',
      file_path: join(root, '.cursor/skills/implement/SKILL.md'),
    });
    assert('discussion implement-read allow file', out.permission === 'allow', JSON.stringify(out));
    const st = readState();
    assert(
      'discussion implement stays null',
      st.phase === 'discussion' && st.implement === null,
      JSON.stringify(st),
    );
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
      st.phase === 'discussion' && st.implement === null,
      JSON.stringify(st),
    );
  }

  // 8b. forge のあと implement Read で解禁
  {
    run('track.mjs', { ...base, hook_event_name: 'beforeSubmitPrompt', prompt: '/forge go' });
    const out = run('track.mjs', {
      ...base,
      hook_event_name: 'beforeReadFile',
      file_path: join(root, '.cursor/skills/implement/SKILL.md'),
    });
    assert('forge track-implement allow', out.permission === 'allow', JSON.stringify(out));
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

  // 10. phase switch resets implement
  {
    run('track.mjs', { ...base, hook_event_name: 'beforeSubmitPrompt', prompt: '/chore typo' });
    const st = readState();
    assert(
      'phase switch resets implement',
      st.phase === 'chore' && st.implement === false,
      JSON.stringify(st),
    );
  }

  // 11. resume: sessionStart 掃除だけでは phase を消さない / ファイル名は維持
  {
    const nameBefore = findStateFileName(root, id);
    writeFileSync(
      stateAbs(),
      JSON.stringify({ phase: 'forge', implement: true, updatedAt: formatJstIso() }, null, 2),
    );
    onSessionStart(root);
    const st = loadState(root, id);
    assert(
      'resume keeps forge+implement',
      st.phase === 'forge' && st.implement === true,
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

  // 13. inject が Gate state を含む（既存ファイルがあれば実名）
  {
    const out = run('inject-context.mjs', { ...base, is_background_agent: false });
    const ctx = out.additional_context || '';
    const name = findStateFileName(root, id);
    assert('inject mentions Gate state', ctx.includes('Gate state'), ctx.slice(0, 200));
    assert('inject mentions dated state path', Boolean(name && ctx.includes(name)), name);
    assert('inject mentions discussion', ctx.includes('discussion'), '');
    assert('inject mentions JST naming', ctx.includes('+0900'), '');
    assert('inject mentions implement null semantics', ctx.includes('`null`'), '');
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

  // 15. transcript_path のみでも gate が chore state を読める
  {
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
      JSON.stringify({ phase: 'chore', implement: true, updatedAt: formatJstIso() }, null, 2) +
        '\n',
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

  // 16. preToolUse Read（tool_input.path）で implement 解禁
  {
    const readId = 'pretooluse-read-id';
    const readBase = { conversation_id: readId, workspace_roots: [root], cwd: root };
    run('track.mjs', { ...readBase, hook_event_name: 'beforeSubmitPrompt', prompt: '/forge go' });
    const out = run('track.mjs', {
      ...readBase,
      hook_event_name: 'preToolUse',
      tool_name: 'Read',
      tool_input: { path: join(root, '.cursor/skills/implement/SKILL.md') },
    });
    assert(
      'preToolUse Read track-implement allow',
      out.permission === 'allow',
      JSON.stringify(out),
    );
    const st = loadState(root, readId);
    assert(
      'preToolUse Read sets implement true',
      st.phase === 'forge' && st.implement === true,
      JSON.stringify(st),
    );
  }

  // 16b. preToolUse ReadFile（Cursor 内部名）で implement 解禁
  {
    const readId = 'pretooluse-readfile-id';
    const readBase = { conversation_id: readId, workspace_roots: [root], cwd: root };
    run('track.mjs', { ...readBase, hook_event_name: 'beforeSubmitPrompt', prompt: '/chore go' });
    run('track.mjs', {
      ...readBase,
      hook_event_name: 'preToolUse',
      tool_name: 'ReadFile',
      tool_input: { path: join(root, '.cursor/skills/implement/SKILL.md') },
    });
    const st = loadState(root, readId);
    assert(
      'preToolUse ReadFile sets implement true',
      st.phase === 'chore' && st.implement === true,
      JSON.stringify(st),
    );
  }

  // 16c. sessionStart env で conversation_id を補完
  {
    const envId = 'session-env-id';
    const prev = process.env[GATE_CONVERSATION_ENV];
    process.env[GATE_CONVERSATION_ENV] = envId;
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
        tool_input: { path: join(root, '.cursor/skills/implement/SKILL.md') },
      });
      const st = loadState(root, envId);
      assert(
        'GATE_CONVERSATION_ENV unlocks implement',
        st.phase === 'chore' && st.implement === true,
        JSON.stringify(st),
      );
    } finally {
      if (prev === undefined) delete process.env[GATE_CONVERSATION_ENV];
      else process.env[GATE_CONVERSATION_ENV] = prev;
    }
  }

  // 20. 統合: track-phase（ID あり）→ implement Read（ID なし）→ Write
  // 実機で壊れた経路。16/16b は毎回 conversation_id 付きなので拾えない。
  {
    const realId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
    const withId = { conversation_id: realId, workspace_roots: [root], cwd: root };
    const noId = { workspace_roots: [root], cwd: root };
    const implementPath = join(root, '.cursor/skills/implement/SKILL.md');
    const probePath = join(root, '.cursor/hooks/_integration-probe.txt');

    run('track.mjs', { ...withId, hook_event_name: 'beforeSubmitPrompt', prompt: '/chore integration' });
    let st = loadState(root, realId);
    assert(
      'integration starts chore locked',
      st.phase === 'chore' && st.implement === false,
      JSON.stringify(st),
    );

    run('track.mjs', {
      ...noId,
      hook_event_name: 'preToolUse',
      tool_name: 'ReadFile',
      tool_input: { path: implementPath },
    });
    st = loadState(root, realId);
    assert('integration without id/env stays locked', st.implement === false, JSON.stringify(st));

    const outInject = run('inject-context.mjs', { ...withId });
    assert(
      'integration inject exports env',
      outInject.env?.[GATE_CONVERSATION_ENV] === realId,
      JSON.stringify(outInject),
    );

    const envOnly = { [GATE_CONVERSATION_ENV]: realId };
    run(
      'track.mjs',
      {
        ...noId,
        hook_event_name: 'preToolUse',
        tool_name: 'ReadFile',
        tool_input: { path: implementPath },
      },
      envOnly,
    );
    st = loadState(root, realId);
    assert('integration env unlocks implement', st.implement === true, JSON.stringify(st));

    const outWrite = run(
      'gate.mjs',
      {
        ...noId,
        hook_event_name: 'preToolUse',
        tool_name: 'Write',
        tool_input: { path: probePath },
      },
      envOnly,
    );
    assert('integration Write allow', outWrite.permission === 'allow', JSON.stringify(outWrite));
    try {
      unlinkSync(probePath);
    } catch {
      // 無ければ無視
    }
  }

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

  // 18. track-phase: /bootstrap と /bootstrap off
  {
    const outOn = run('track.mjs', { ...base, hook_event_name: 'beforeSubmitPrompt', prompt: '/bootstrap harness rescue' });
    assert('track-phase bootstrap on', outOn.continue === true, JSON.stringify(outOn));
    assert('track-phase created marker', isBootstrapActive(root));
    const outOff = run('track.mjs', { ...base, hook_event_name: 'beforeSubmitPrompt', prompt: '/bootstrap off thanks' });
    assert('track-phase bootstrap off', outOff.continue === true, JSON.stringify(outOff));
    assert('track-phase removed marker', !isBootstrapActive(root));
  }

  // 19. sessionEnd でマーカー削除
  {
    enableBootstrap(root);
    run('session-end.mjs', { ...base });
    assert('sessionEnd removes bootstrap marker', !isBootstrapActive(root));
  }

  // 20. gate: root への cd は拒否
  {
    const cdId = 'cd-root-test-id';
    const cdBase = { conversation_id: cdId, workspace_roots: [root], cwd: root };
    run('track.mjs', { ...cdBase, hook_event_name: 'beforeSubmitPrompt', prompt: '/chore cd test' });
    run('track.mjs', {
      ...cdBase,
      hook_event_name: 'preToolUse',
      tool_name: 'ReadFile',
      tool_input: { path: join(root, '.cursor/skills/implement/SKILL.md') },
    });
    const stCd = loadState(root, cdId);
    assert(
      'cd test conversation unlocked',
      stCd.phase === 'chore' && stCd.implement === true,
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
    assert('reject cd utils then cd ..', denyChain.permission === 'deny', JSON.stringify(denyChain));

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
    assert('allow command without cd', allowPlain.permission === 'allow', JSON.stringify(allowPlain));

    const allowParent = run('gate.mjs', {
      ...cdBase,
      hook_event_name: 'beforeShellExecution',
      command: 'cd ..',
    });
    assert('allow cd .. from root', allowParent.permission === 'allow', JSON.stringify(allowParent));
  }

  // 21. review gate: dirty → commit deny → preToolUse Task → commit allow
  {
    const reviewId = 'review-gate-id';
    const reviewBase = { conversation_id: reviewId, workspace_roots: [root], cwd: root };
    run('track.mjs', { ...reviewBase, hook_event_name: 'beforeSubmitPrompt', prompt: '/chore review test' });
    run('track.mjs', {
      ...reviewBase,
      hook_event_name: 'preToolUse',
      tool_name: 'ReadFile',
      tool_input: { path: join(root, '.cursor/skills/implement/SKILL.md') },
    });
    run('track.mjs', {
      ...reviewBase,
      hook_event_name: 'postToolUse',
      tool_name: 'Write',
      tool_input: { path: join(root, 'utils/_review-probe.ts') },
    });
    const stDirty = loadState(root, reviewId);
    assert(
      'review dirty after product write',
      stDirty.review?.required === true && stDirty.review?.done === false,
      JSON.stringify(stDirty),
    );

    const denyCommit = run('gate.mjs', {
      ...reviewBase,
      hook_event_name: 'beforeShellExecution',
      command: 'git commit -m test',
    });
    assert('review blocks git commit', denyCommit.permission === 'deny', JSON.stringify(denyCommit));

    run('track.mjs', {
      ...reviewBase,
      hook_event_name: 'preToolUse',
      tool_name: 'Task',
      tool_input: { subagent_type: 'pre-commit-reviewer', description: 'review before commit' },
    });
    const stDone = loadState(root, reviewId);
    assert('preToolUse Task sets review done', stDone.review?.done === true, JSON.stringify(stDone));

    const allowCommit = run('gate.mjs', {
      ...reviewBase,
      hook_event_name: 'beforeShellExecution',
      command: 'git commit -m test',
    });
    assert('review allows git commit after done', allowCommit.permission === 'allow', JSON.stringify(allowCommit));

    run('track.mjs', {
      ...reviewBase,
      hook_event_name: 'postToolUse',
      tool_name: 'Write',
      tool_input: { path: join(root, 'utils/_review-probe.ts') },
    });
    const stRedirty = loadState(root, reviewId);
    assert(
      're-edit resets review done',
      stRedirty.review?.required === true && stRedirty.review?.done === false,
      JSON.stringify(stRedirty),
    );
  }
} finally {
  rmSync(stateTmp, { recursive: true, force: true });
  disableBootstrap(root);
  if (existsSync(smokeTmpRoot) && readdirSync(smokeTmpRoot).length === 0) {
    rmSync(smokeTmpRoot, { recursive: true, force: true });
  }
}

if (failed > 0) {
  process.stderr.write(`\n${failed} failed\n`);
  process.exit(1);
}
process.stdout.write('\nall passed\n');

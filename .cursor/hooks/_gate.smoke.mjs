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
import { clearStubTurn, isStubTurnActive, lastStubPath } from './_mentor.mjs';
import {
  findStateFileName,
  formatJstIso,
  idFromTranscriptPath,
  lastPromptIdPath,
  loadState,
  onSessionStart,
  PHASE_DISCUSSION,
  purgeStaleStates,
  readLastPromptId,
  STATE_TTL_DAYS,
} from './_state.mjs';
import { buildReviewTaskInjection, collectReviewDiff, isReviewablePath } from './_review.mjs';

function clearSticky() {
  try {
    unlinkSync(lastPromptIdPath(root));
  } catch {
    // 無ければ無視
  }
  clearStubTurn(root);
}

const hooksDir = fileURLToPath(new URL('.', import.meta.url));
const root = resolve(hooksDir, '../..');
const smokeTmpRoot = join(hooksDir, '.smoke-tmp');
mkdirSync(smokeTmpRoot, { recursive: true });

function trackRead(convBase, relPath) {
  run('track.mjs', {
    ...convBase,
    hook_event_name: 'preToolUse',
    tool_name: 'ReadFile',
    tool_input: { path: join(root, relPath) },
  });
}

function trackReadTsRef(convBase) {
  trackRead(convBase, '.cursor/skills/rules/references/shared.md');
}

function trackReadIssueSkill(convBase) {
  trackRead(convBase, '.cursor/skills/issue/SKILL.md');
}

function trackReadBuildTemplate(convBase) {
  trackRead(convBase, '.cursor/skills/issue/references/build-template.md');
}
const stateTmp = mkdtempSync(join(smokeTmpRoot, 'state-'));
const id = 'test-conversation';

/** 実プロジェクトの bootstrap を汚さない／消したままにしない */
const restoreBootstrap = isBootstrapActive(root);

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
      command: 'node .cursor/skills/label/scripts/set-label.mjs topic-a',
    });
    assert('locked set-label allow', out.permission === 'allow', JSON.stringify(out));

    const outWithReadonly = run('gate.mjs', {
      ...base,
      hook_event_name: 'beforeShellExecution',
      command: 'node .cursor/skills/label/scripts/set-label.mjs topic-a && git status',
    });
    assert(
      'locked set-label + readonly allow',
      outWithReadonly.permission === 'allow',
      JSON.stringify(outWithReadonly),
    );

    const outChain = run('gate.mjs', {
      ...base,
      hook_event_name: 'beforeShellExecution',
      command: 'node .cursor/skills/label/scripts/set-label.mjs topic-a && pnpm test:run',
    });
    assert('locked set-label chain deny', outChain.permission === 'deny', JSON.stringify(outChain));

    const outBg = run('gate.mjs', {
      ...base,
      hook_event_name: 'beforeShellExecution',
      command: 'node .cursor/skills/label/scripts/set-label.mjs topic-a & pnpm test:run',
    });
    assert('locked set-label bg deny', outBg.permission === 'deny', JSON.stringify(outBg));

    const outNl = run('gate.mjs', {
      ...base,
      hook_event_name: 'beforeShellExecution',
      command: 'node .cursor/skills/label/scripts/set-label.mjs topic-a\npnpm test:run',
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
      prompt: '/work lock plan',
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
        st.unlock.issueTemplate === undefined,
      JSON.stringify(st),
    );
  }

  // 7. still deny Write after phase only — gh issue write needs handshake; git writes unlock
  {
    const out = run('gate.mjs', {
      ...base,
      hook_event_name: 'preToolUse',
      tool_name: 'Write',
      tool_input: { path: join(root, 'utils/foo.ts') },
    });
    assert('phase-only Write deny', out.permission === 'deny', JSON.stringify(out));

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

    const outPnpmInstall = run('gate.mjs', {
      ...base,
      hook_event_name: 'beforeShellExecution',
      command: 'pnpm install',
    });
    assert(
      'phase-only pnpm install deny',
      outPnpmInstall.permission === 'deny',
      JSON.stringify(outPnpmInstall),
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

  // 8. discussion 中の rules Read はフラグを立てない／Write 不可
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

  // 8b. work のあと rules Read で解禁
  {
    run('track.mjs', { ...base, hook_event_name: 'beforeSubmitPrompt', prompt: '/work go' });
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
        Array.isArray(st.read.refs) &&
        st.read.refs.length === 0 &&
        Array.isArray(st.read.skills) &&
        st.read.skills.length === 0,
      JSON.stringify(st),
    );

    run('track.mjs', {
      ...base,
      hook_event_name: 'beforeReadFile',
      file_path: join(root, '.cursor/skills/rules/SKILL.md'),
    });
    trackReadTsRef(base);
    assert(
      'chore unlock + ref before re-entry',
      loadState(root, id).unlock.rules === true &&
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
      'same-phase re-entry resets rules and read',
      stRe.phase === 'chore' &&
        stRe.unlock.rules === false &&
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
      tool_input: { path: rulesPath },
    });
    st = loadState(root, realId);
    assert(
      'integration sticky unlocks without payload id',
      st.unlock.rules === true,
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

  // 21. review gate: dirty → commit deny → reviewer → files clear → commit allow → re-edit
  {
    const reviewId = 'review-gate-id';
    const reviewBase = { conversation_id: reviewId, workspace_roots: [root], cwd: root };
    run('track.mjs', {
      ...reviewBase,
      hook_event_name: 'beforeSubmitPrompt',
      prompt: '/chore review test',
    });
    run('track.mjs', {
      ...reviewBase,
      hook_event_name: 'preToolUse',
      tool_name: 'ReadFile',
      tool_input: { path: join(root, '.cursor/skills/rules/SKILL.md') },
    });
    writeFileSync(join(root, 'utils/_review-probe.ts'), 'export const reviewProbe = 1;\n');
    writeFileSync(
      join(root, '.cursor/hooks/_harness-review-probe.mjs'),
      'export const harnessReviewProbe = 1;\n',
    );
    trackReadTsRef(reviewBase);
    run('track.mjs', {
      ...reviewBase,
      hook_event_name: 'postToolUse',
      tool_name: 'Write',
      tool_input: { path: join(root, 'utils/_review-probe.ts') },
    });
    run('track.mjs', {
      ...reviewBase,
      hook_event_name: 'postToolUse',
      tool_name: 'Write',
      tool_input: { path: join(root, '.cursor/hooks/_harness-review-probe.mjs') },
    });
    const stDirty = loadState(root, reviewId);
    assert(
      'review files after edits',
      Array.isArray(stDirty.review?.files) &&
        stDirty.review.files.includes('utils/_review-probe.ts') &&
        stDirty.review.files.includes('.cursor/hooks/_harness-review-probe.mjs'),
      JSON.stringify(stDirty),
    );

    const denyCommit = run('gate.mjs', {
      ...reviewBase,
      hook_event_name: 'beforeShellExecution',
      command: 'git commit -m test',
    });
    assert(
      'review blocks git commit',
      denyCommit.permission === 'deny',
      JSON.stringify(denyCommit),
    );

    const injectOut = run('track.mjs', {
      ...reviewBase,
      hook_event_name: 'preToolUse',
      tool_name: 'Task',
      tool_input: { subagent_type: 'pre-commit-reviewer', description: 'review before commit' },
    });
    const injected = String(injectOut.updated_input?.description ?? '');
    const injectedTask = String(injectOut.updated_input?.task ?? '');
    assert(
      'preToolUse Task injects review.files into prompt',
      injectOut.permission === 'allow' &&
        injected.includes('[harness-review]') &&
        injected.includes('utils/_review-probe.ts') &&
        injected.includes('.cursor/hooks/_harness-review-probe.mjs') &&
        injected.includes('reviewProbe') &&
        injected.includes('Do not run git') &&
        injectedTask.includes('[harness-review]'),
      JSON.stringify(injectOut),
    );
    try {
      unlinkSync(join(root, 'utils/_review-probe.ts'));
      unlinkSync(join(root, '.cursor/hooks/_harness-review-probe.mjs'));
    } catch {
      // 無ければ無視
    }

    const trackedPath = 'utils/types.ts';
    const trackedAbs = join(root, trackedPath);
    const trackedOriginal = readFileSync(trackedAbs, 'utf8');
    try {
      writeFileSync(trackedAbs, `${trackedOriginal}\n// smoke-tracked-diff-probe\n`);
      const got = collectReviewDiff(root, trackedPath);
      assert(
        'tracked edit yields kind diff',
        got.kind === 'diff' && got.body.includes('smoke-tracked-diff-probe'),
        JSON.stringify(got),
      );
      const block = buildReviewTaskInjection(root, [trackedPath]);
      assert(
        'injection includes diff fence for tracked edit',
        Boolean(block) &&
          block.includes('```diff') &&
          block.includes('smoke-tracked-diff-probe') &&
          block.includes(trackedPath),
        String(block).slice(0, 500),
      );
    } finally {
      writeFileSync(trackedAbs, trackedOriginal);
    }
    const stReviewed = loadState(root, reviewId);
    assert(
      'preToolUse Task clears review.files',
      Array.isArray(stReviewed.review?.files) && stReviewed.review.files.length === 0,
      JSON.stringify(stReviewed),
    );

    const allowCommit = run('gate.mjs', {
      ...reviewBase,
      hook_event_name: 'beforeShellExecution',
      command: 'git commit -m test',
    });
    assert(
      'review allows git commit when files empty',
      allowCommit.permission === 'allow',
      JSON.stringify(allowCommit),
    );

    run('track.mjs', {
      ...reviewBase,
      hook_event_name: 'beforeShellExecution',
      command: 'git commit -m test',
    });
    const stStillClear = loadState(root, reviewId);
    assert(
      'beforeShell commit attempt does not refill files',
      Array.isArray(stStillClear.review?.files) && stStillClear.review.files.length === 0,
      JSON.stringify(stStillClear),
    );

    run('track.mjs', {
      ...reviewBase,
      hook_event_name: 'afterShellExecution',
      command: 'git commit -m test',
      exit_code: 0,
    });
    const stAfter = loadState(root, reviewId);
    assert(
      'successful commit keeps review.files empty',
      Array.isArray(stAfter.review?.files) && stAfter.review.files.length === 0,
      JSON.stringify(stAfter),
    );

    run('track.mjs', {
      ...reviewBase,
      hook_event_name: 'afterShellExecution',
      command: 'git add .cursor/hooks/_missed-by-write.mjs utils/_from-add.ts',
      exit_code: 0,
    });
    const stAdd = loadState(root, reviewId);
    assert(
      'git add does not change review state',
      Array.isArray(stAdd.review?.files) && stAdd.review.files.length === 0,
      JSON.stringify(stAdd),
    );

    run('track.mjs', {
      ...reviewBase,
      hook_event_name: 'postToolUse',
      tool_name: 'Write',
      tool_input: { path: join(root, 'docs/_not-reviewable.md') },
    });
    run('track.mjs', {
      ...reviewBase,
      hook_event_name: 'postToolUse',
      tool_name: 'Write',
      tool_input: { path: join(root, 'package-lock-probe.json') },
    });
    const stDocs = loadState(root, reviewId);
    assert(
      'md/json edits do not enter review.files',
      Array.isArray(stDocs.review?.files) && stDocs.review.files.length === 0,
      JSON.stringify(stDocs),
    );

    run('track.mjs', {
      ...reviewBase,
      hook_event_name: 'postToolUse',
      tool_name: 'Write',
      tool_input: { path: join(root, 'utils/_review-probe.ts') },
    });
    const stRedirty = loadState(root, reviewId);
    assert(
      're-edit refills review.files',
      Array.isArray(stRedirty.review?.files) &&
        stRedirty.review.files.includes('utils/_review-probe.ts'),
      JSON.stringify(stRedirty),
    );

    const denyAfterAddCommit = run('gate.mjs', {
      ...reviewBase,
      hook_event_name: 'beforeShellExecution',
      command: 'git add utils/_review-probe.ts && git commit -m test',
    });
    assert(
      'add&&commit still blocked while files non-empty',
      denyAfterAddCommit.permission === 'deny' &&
        String(denyAfterAddCommit.agent_message ?? denyAfterAddCommit.user_message ?? '').includes(
          'utils/_review-probe.ts',
        ),
      JSON.stringify(denyAfterAddCommit),
    );
  }

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

  // 22. sessionStart inject: 前会話 sticky があっても payload の state を出し、sticky を更新
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
      'inject refreshes sticky to new id',
      readLastPromptId(root) === newId,
      String(readLastPromptId(root)),
    );
  }

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
} finally {
  rmSync(stateTmp, { recursive: true, force: true });
  // state 以外の一時物も含め、ルートごと消す（空判定に頼らない）
  rmSync(smokeTmpRoot, { recursive: true, force: true });
  if (restoreBootstrap) enableBootstrap(root);
  else disableBootstrap(root);
}

if (existsSync(smokeTmpRoot)) {
  failed += 1;
  process.stderr.write('FAIL - smoke-tmp cleaned up\n');
} else {
  process.stdout.write('ok  - smoke-tmp cleaned up\n');
}

if (failed > 0) {
  process.stderr.write(`\n${failed} failed\n`);
  process.exit(1);
}
process.stdout.write('\nall passed\n');

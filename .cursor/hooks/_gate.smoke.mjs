#!/usr/bin/env node
/**
 * ゲート hooks のスモークテスト（Cursor 実行時なし）。
 * 使い方: node .cursor/hooks/_gate.smoke.mjs
 */
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import {
  findStateFileName,
  formatJstIso,
  loadState,
  onSessionStart,
  purgeStaleStates,
  STATE_TTL_DAYS,
} from './state.mjs';

const hooksDir = fileURLToPath(new URL('.', import.meta.url));
const root = resolve(hooksDir, '../..');
const stateTmp = mkdtempSync(join(tmpdir(), 'cursor-gate-'));
const id = 'test-conversation';

let failed = 0;

function run(script, payload) {
  const r = spawnSync(process.execPath, [join(hooksDir, script)], {
    input: JSON.stringify(payload),
    encoding: 'utf8',
    env: {
      ...process.env,
      CURSOR_GATE_STATE_DIR: stateTmp,
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

// 0. sessionStart はファイルを作らない。初回発話で discussion を実体化。
{
  onSessionStart(root);
  assert('sessionStart creates no file', findStateFileName(root, id) === null);
  const outInject = run('inject-context.mjs', { ...base, is_background_agent: false });
  const ctx0 = outInject.additional_context || '';
  assert(
    'inject hints glob path',
    ctx0.includes(`*__${id}.json`),
    ctx0.includes('hooks/state') ? 'glob missing' : 'no gate section',
  );
  assert('inject still no file', findStateFileName(root, id) === null);

  const outGate = run('gate-code.mjs', {
    ...base,
    hook_event_name: 'preToolUse',
    tool_name: 'Write',
    tool_input: { path: join(root, 'utils/foo.ts') },
  });
  assert('gate deny without state file', outGate.permission === 'deny', JSON.stringify(outGate));
  assert('gate does not create file', findStateFileName(root, id) === null);

  // 初回発話（phase コマンドなし）→ discussion
  run('track-phase.mjs', { ...base, prompt: 'hello, just discussing' });
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
  const out = run('gate-code.mjs', {
    ...base,
    hook_event_name: 'preToolUse',
    tool_name: 'Write',
    tool_input: { path: join(root, 'utils/foo.ts') },
  });
  assert('locked Write deny', out.permission === 'deny', JSON.stringify(out));
}

// 2. root md allow while locked
{
  const out = run('gate-code.mjs', {
    ...base,
    hook_event_name: 'preToolUse',
    tool_name: 'Write',
    tool_input: { path: join(root, 'README.md') },
  });
  assert('locked root md allow', out.permission === 'allow', JSON.stringify(out));
}

// 3. locked nested md deny
{
  const out = run('gate-code.mjs', {
    ...base,
    hook_event_name: 'preToolUse',
    tool_name: 'Write',
    tool_input: { path: join(root, 'docs/notes.md') },
  });
  assert('locked nested md deny', out.permission === 'deny', JSON.stringify(out));
}

// 4. discussion: gh/git read allow, write deny
{
  const outList = run('gate-code.mjs', {
    ...base,
    hook_event_name: 'beforeShellExecution',
    command: 'gh issue list',
  });
  assert('discussion gh issue list allow', outList.permission === 'allow', JSON.stringify(outList));

  const outCreate = run('gate-code.mjs', {
    ...base,
    hook_event_name: 'beforeShellExecution',
    command: 'gh issue create --title t --body b',
  });
  assert(
    'discussion gh issue create deny',
    outCreate.permission === 'deny',
    JSON.stringify(outCreate),
  );

  const outStatus = run('gate-code.mjs', {
    ...base,
    hook_event_name: 'beforeShellExecution',
    command: 'git status',
  });
  assert(
    'discussion git status allow',
    outStatus.permission === 'allow',
    JSON.stringify(outStatus),
  );

  const outCommit = run('gate-code.mjs', {
    ...base,
    hook_event_name: 'beforeShellExecution',
    command: 'git commit -m msg',
  });
  assert('discussion git commit deny', outCommit.permission === 'deny', JSON.stringify(outCommit));
}

// 5. pnpm deny while locked
{
  const out = run('gate-code.mjs', {
    ...base,
    hook_event_name: 'beforeShellExecution',
    command: 'pnpm test:run',
  });
  assert('locked pnpm deny', out.permission === 'deny', JSON.stringify(out));
}

// 6. track phase — 既存 discussion を forge に更新（新規ファイルは増やさない）
{
  const nameBefore = findStateFileName(root, id);
  const out = run('track-phase.mjs', {
    ...base,
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
  const out = run('gate-code.mjs', {
    ...base,
    hook_event_name: 'preToolUse',
    tool_name: 'Write',
    tool_input: { path: join(root, 'utils/foo.ts') },
  });
  assert('phase-only Write deny', out.permission === 'deny', JSON.stringify(out));

  const outGh = run('gate-code.mjs', {
    ...base,
    hook_event_name: 'beforeShellExecution',
    command: 'gh issue create --title t --body b',
  });
  assert('phase unlocks gh write', outGh.permission === 'allow', JSON.stringify(outGh));

  const outGit = run('gate-code.mjs', {
    ...base,
    hook_event_name: 'beforeShellExecution',
    command: 'git commit -m msg',
  });
  assert('phase unlocks git write', outGit.permission === 'allow', JSON.stringify(outGit));

  const outPnpm = run('gate-code.mjs', {
    ...base,
    hook_event_name: 'beforeShellExecution',
    command: 'pnpm test:run',
  });
  assert('phase-only pnpm still deny', outPnpm.permission === 'deny', JSON.stringify(outPnpm));
}

// 8. discussion 中の implement Read はフラグを立てない／Write 不可
{
  // discussion に戻す（/discussion 相当）
  run('track-phase.mjs', { ...base, prompt: '/discussion step back' });
  const out = run('track-implement.mjs', {
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
  const out2 = run('gate-code.mjs', {
    ...base,
    hook_event_name: 'preToolUse',
    tool_name: 'Write',
    tool_input: { path: join(root, 'utils/foo.ts') },
  });
  assert('discussion Write still deny', out2.permission === 'deny', JSON.stringify(out2));

  const outGh = run('gate-code.mjs', {
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
  run('track-phase.mjs', { ...base, prompt: '/forge go' });
  const out = run('track-implement.mjs', {
    ...base,
    hook_event_name: 'beforeReadFile',
    file_path: join(root, '.cursor/skills/implement/SKILL.md'),
  });
  assert('forge track-implement allow', out.permission === 'allow', JSON.stringify(out));
  const out2 = run('gate-code.mjs', {
    ...base,
    hook_event_name: 'preToolUse',
    tool_name: 'Write',
    tool_input: { path: join(root, 'utils/foo.ts') },
  });
  assert('unlocked Write allow', out2.permission === 'allow', JSON.stringify(out2));
}

// 9. unlocked でも state 編集は deny
{
  const out = run('gate-code.mjs', {
    ...base,
    hook_event_name: 'preToolUse',
    tool_name: 'Write',
    tool_input: { path: stateAbs() },
  });
  assert('state Write always deny', out.permission === 'deny', JSON.stringify(out));
}

// 9b. ls …/state/ 2>/dev/null は allow（> の誤検知防止）
{
  const out = run('gate-code.mjs', {
    ...base,
    hook_event_name: 'beforeShellExecution',
    command: 'ls .cursor/hooks/state/ 2>/dev/null',
  });
  assert('ls state with 2>/dev/null allow', out.permission === 'allow', JSON.stringify(out));
}

// 9c. state へリダイレクトは deny
{
  const out = run('gate-code.mjs', {
    ...base,
    hook_event_name: 'beforeShellExecution',
    command: 'echo x > .cursor/hooks/state/evil.json',
  });
  assert('redirect into state deny', out.permission === 'deny', JSON.stringify(out));
}

// 10. phase switch resets implement
{
  run('track-phase.mjs', { ...base, prompt: '/chore typo' });
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

rmSync(stateTmp, { recursive: true, force: true });

if (failed > 0) {
  process.stderr.write(`\n${failed} failed\n`);
  process.exit(1);
}
process.stdout.write('\nall passed\n');

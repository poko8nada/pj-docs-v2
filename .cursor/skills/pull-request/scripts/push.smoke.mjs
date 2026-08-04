#!/usr/bin/env node

import { publishPrepared } from './push.mjs';

// fake Git境界で、部分公開・既存remote・依存関係・head不一致を検証する。
function main() {
  const tests = [
    ['publishes only the selected PR', testPartialPublish],
    ['skips a head already published remotely', testAlreadyPublished],
    ['requires selected dependencies', testDependencySelection],
    ['rejects a local head outside the delivery boundary', testHeadMismatch],
    ['reports heads published before a later failure', testPartialFailure],
  ];
  let failures = 0;

  for (const [name, test] of tests) {
    try {
      test();
      process.stdout.write(`PASS ${name}\n`);
    } catch (error) {
      failures += 1;
      process.stderr.write(`FAIL ${name}: ${errorMessage(error)}\n`);
    }
  }

  if (failures > 0) process.exitCode = 1;
}

// 二つの候補のうち一つだけを選び、他方をpushしないことを確認する。
function testPartialPublish() {
  const prepared = buildPrepared();
  const state = createGitState({
    local: { 'pr/first': prepared.prs[0].expectedHead, 'pr/second': prepared.prs[1].expectedHead },
  });
  const result = publishPrepared({
    root: '/repo',
    prepared,
    selectedPrIds: ['first'],
    runGitCommand: state.run,
  });

  assert(result.selectedPrIds.join(',') === 'first', JSON.stringify(result));
  assert(result.publication[0].status === 'pushed', JSON.stringify(result));
  assert(state.remote['pr/first'] === prepared.prs[0].expectedHead, state);
  assert(!state.remote['pr/second'], state);
  assert(state.pushes.join(',') === 'pr/first', state);
}

// remote headがdelivery headと一致する場合は、再pushせず公開済みとして扱う。
function testAlreadyPublished() {
  const prepared = buildPrepared();
  const state = createGitState({
    local: { 'pr/first': prepared.prs[0].expectedHead },
    remote: { 'pr/first': prepared.prs[0].expectedHead },
  });
  const result = publishPrepared({
    root: '/repo',
    prepared,
    selectedPrIds: ['first'],
    runGitCommand: state.run,
  });

  assert(result.publication[0].status === 'already_published', JSON.stringify(result));
  assert(state.pushes.length === 0, state);
}

// stacked PRの後続だけを選び、base PRの公開を省略することを拒否する。
function testDependencySelection() {
  const prepared = buildPrepared();
  const state = createGitState({
    local: { 'pr/second': prepared.prs[1].expectedHead },
  });
  let error;
  try {
    publishPrepared({
      root: '/repo',
      prepared,
      selectedPrIds: ['second'],
      runGitCommand: state.run,
    });
  } catch (caughtError) {
    error = caughtError;
  }

  assert(error?.message.includes('requires dependency'), error);
  assert(state.pushes.length === 0, state);
  assert(Object.keys(state.remote).length === 0, state);
}

// local branchがdelivery headと違う場合、後続commitを誤って公開しない。
function testHeadMismatch() {
  const prepared = buildPrepared();
  const state = createGitState({
    local: { 'pr/first': 'f'.repeat(40) },
  });
  let error;
  try {
    publishPrepared({
      root: '/repo',
      prepared,
      selectedPrIds: ['first'],
      runGitCommand: state.run,
    });
  } catch (caughtError) {
    error = caughtError;
  }

  assert(error?.message.includes('expected'), error);
  assert(state.pushes.length === 0, state);
  assert(Object.keys(state.remote).length === 0, state);
}

// 後続headで失敗しても、先に公開済みになったheadを結果へ残す。
function testPartialFailure() {
  const prepared = buildPrepared();
  const state = createGitState({
    local: { 'pr/first': prepared.prs[0].expectedHead, 'pr/second': 'f'.repeat(40) },
  });
  let error;
  try {
    publishPrepared({
      root: '/repo',
      prepared,
      selectedPrIds: ['first', 'second'],
      runGitCommand: state.run,
    });
  } catch (caughtError) {
    error = caughtError;
  }

  assert(error?.publication?.[0].id === 'first', error);
  assert(error.message.includes('Published before failure: first'), error);
  assert(state.remote['pr/first'] === prepared.prs[0].expectedHead, state);
}

// Push処理が扱う最小のB方式prepared入力を作る。
function buildPrepared() {
  return {
    mode: 'B',
    prs: [
      {
        id: 'first',
        base: 'develop',
        head: 'pr/first',
        expectedHead: 'a'.repeat(40),
        dependsOn: [],
      },
      {
        id: 'second',
        base: 'pr/first',
        head: 'pr/second',
        expectedHead: 'b'.repeat(40),
        dependsOn: ['first'],
      },
    ],
  };
}

// Git ref状態をメモリで再現し、push対象と呼び出し順を観測する。
function createGitState({ local = {}, remote = {} } = {}) {
  const pushes = [];
  return {
    local,
    remote,
    pushes,
    run(_root, args, { allowFailure = false } = {}) {
      if (args[0] === 'ls-remote') {
        const branch = args.at(-1).replace('refs/heads/', '');
        const sha = remote[branch];
        return { status: 0, stdout: sha ? `${sha}\trefs/heads/${branch}\n` : '', stderr: '' };
      }
      if (args[0] === 'rev-parse') {
        const branch = args.at(-1).replace('refs/heads/', '');
        const sha = local[branch];
        return sha
          ? { status: 0, stdout: `${sha}\n`, stderr: '' }
          : { status: allowFailure ? 1 : 1, stdout: '', stderr: 'missing local ref' };
      }
      if (args[0] === 'push') {
        const branch = args.at(-1);
        pushes.push(branch);
        remote[branch] = local[branch];
        return { status: 0, stdout: '', stderr: '' };
      }
      throw new Error(`Unexpected git command: ${args.join(' ')}`);
    },
  };
}

// Errorを安定したテキストへ変換する。
function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

// Smokeの期待値を一箇所で検証する。
function assert(condition, detail) {
  if (!condition) throw new Error(`assertion failed: ${detail}`);
}

main();

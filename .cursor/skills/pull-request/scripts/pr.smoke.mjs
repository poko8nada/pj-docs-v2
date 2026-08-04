#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createOrUpdatePullRequests } from './pr.mjs';

const ROOT = dirname(fileURLToPath(import.meta.url));

// fake gh境界で、公開済みheadの作成・更新・未公開拒否を検証する。
function main() {
  const runRoot = mkdtempSync(join(ROOT, '.pr-smoke-'));
  const tests = [
    ['creates a pull request from a published head', testCreate],
    ['updates an existing pull request', testUpdate],
    ['rejects an unpublished prepared input', testUnpublished],
  ];
  let failures = 0;

  try {
    for (const [name, test] of tests) {
      try {
        test(runRoot);
        process.stdout.write(`PASS ${name}\n`);
      } catch (error) {
        failures += 1;
        process.stderr.write(`FAIL ${name}: ${errorMessage(error)}\n`);
      }
    }
  } finally {
    rmSync(runRoot, { recursive: true, force: true });
  }

  if (failures > 0) process.exitCode = 1;
}

// 未作成PRでは公開済みheadに対してgh pr createが呼ばれ、本文に範囲情報が残る。
function testCreate(runRoot) {
  const fixture = createFixture(runRoot);
  const prepared = buildPrepared(fixture);
  const events = [];
  const result = createOrUpdatePullRequests({
    root: fixture.repo,
    prepared,
    runGhCommand: (args, options = {}) => {
      events.push({ args, options });
      if (args[1] === 'list') return '[]';
      assert(args[1] === 'create', args.join(' '));
      assert(options.input.includes('## Intent'), options.input);
      assert(options.input.includes('すべての内容を接続する'), options.input);
      assert(
        options.input.includes('内容全体を一つのレビュー可能な成果として確認できる'),
        options.input,
      );
      assert(options.input.includes(fixture.source), options.input);
      return 'https://github.com/example/repo/pull/1\n';
    },
  });

  assert(result.pullRequests[0].action === 'created', JSON.stringify(result));
  assert(result.pullRequests[0].url.endsWith('/1'), JSON.stringify(result));
  assert(
    events.some((event) => event.args?.[1] === 'create'),
    JSON.stringify(events),
  );
}

// 同じhead/baseの既存PRではcreateせず、本文をeditする。
function testUpdate(runRoot) {
  const fixture = createFixture(runRoot);
  const prepared = buildPrepared(fixture);
  const calls = [];
  const result = createOrUpdatePullRequests({
    root: fixture.repo,
    prepared,
    runGhCommand: (args, options = {}) => {
      calls.push({ args, options });
      if (args[1] === 'list') {
        return JSON.stringify([
          { number: 7, url: 'https://github.com/example/repo/pull/7', state: 'OPEN' },
        ]);
      }
      assert(args[1] === 'edit', args.join(' '));
      return '';
    },
  });

  assert(result.pullRequests[0].action === 'updated', JSON.stringify(result));
  assert(result.pullRequests[0].number === 7, JSON.stringify(result));
  assert(
    calls.some(({ args }) => args[1] === 'edit'),
    JSON.stringify(calls),
  );
  assert(!calls.some(({ args }) => args[1] === 'create'), JSON.stringify(calls));
}

// push結果がないprepared inputではGitHubへ副作用を出さずに停止する。
function testUnpublished(runRoot) {
  const fixture = createFixture(runRoot);
  const prepared = buildPrepared(fixture);
  delete prepared.selectedPrIds;
  let ghCalls = 0;
  let error;
  try {
    createOrUpdatePullRequests({
      root: fixture.repo,
      prepared,
      runGhCommand: () => {
        ghCalls += 1;
        return '[]';
      },
    });
  } catch (caughtError) {
    error = caughtError;
  }

  assert(error?.message.includes('selected PR'), error);
  assert(ghCalls === 0, `gh calls: ${ghCalls}`);
}

// subjectを読める最小のcommit済みfixtureを作る。
function createFixture(runRoot) {
  const repo = mkdtempSync(join(runRoot, 'repo-'));
  mkdirSync(join(repo, 'src'), { recursive: true });
  writeFileSync(join(repo, 'src/a.mjs'), 'export const a = 1;\n');
  git(repo, ['init', '-q']);
  git(repo, ['add', '.']);
  git(repo, ['commit', '-qm', 'init']);
  const source = git(repo, ['rev-parse', 'HEAD']).stdout.trim();
  return { repo, source };
}

// PR作成処理へ渡すMode Aのprepared形式を作る。
function buildPrepared(fixture) {
  return {
    mode: 'A',
    prs: [
      {
        id: 'all-content',
        intent: 'すべての内容を接続する',
        behavior: '内容全体を一つのレビュー可能な成果として確認できる',
        commits: [fixture.source],
        sourceCommits: [fixture.source],
        sourceToPrepared: [{ source: fixture.source, prepared: fixture.source }],
        paths: ['src/a.mjs'],
        base: 'develop',
        head: 'feature',
        expectedHead: fixture.source,
        branchOperation: 'none',
        dependsOn: [],
        note: 'PR smoke用のfixture。',
      },
    ],
    selectedPrIds: ['all-content'],
    publication: [
      {
        id: 'all-content',
        head: 'feature',
        expectedHead: fixture.source,
        status: 'already_published',
      },
    ],
  };
}

// fixture repoのGit操作を実行する。
function git(repo, args) {
  const result = spawnSync('git', args, {
    cwd: repo,
    encoding: 'utf8',
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: 'Pull Request Smoke',
      GIT_AUTHOR_EMAIL: 'pull-request-smoke@example.invalid',
      GIT_COMMITTER_NAME: 'Pull Request Smoke',
      GIT_COMMITTER_EMAIL: 'pull-request-smoke@example.invalid',
    },
  });
  if (result.status !== 0) throw new Error(`git ${args.join(' ')} failed: ${result.stderr}`);
  return result;
}

// Smokeの期待値を一箇所で検証する。
function assert(condition, detail) {
  if (!condition) throw new Error(`assertion failed: ${detail}`);
}

// Errorを安定したテキストへ変換する。
function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

main();

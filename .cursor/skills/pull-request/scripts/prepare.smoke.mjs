#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inventoryCommits } from './inventory.mjs';
import { prepareMode } from './prepare.mjs';

const ROOT = dirname(fileURLToPath(import.meta.url));

// 一時Git repositoryでA/B/Cのbranch準備と失敗時復旧を検証する。
function main() {
  Object.assign(process.env, {
    GIT_AUTHOR_NAME: 'Pull Request Prepare Smoke',
    GIT_AUTHOR_EMAIL: 'pull-request-prepare@example.invalid',
    GIT_COMMITTER_NAME: 'Pull Request Prepare Smoke',
    GIT_COMMITTER_EMAIL: 'pull-request-prepare@example.invalid',
  });
  const runRoot = mkdtempSync(join(ROOT, '.prepare-smoke-'));
  const tests = [
    ['mode A keeps the current branch', testModeA],
    ['mode A reuses a remote delivery head', testModeAPartial],
    ['mode B creates source-order branch refs', testModeB],
    ['mode C cherry-picks complete commits', testModeC],
    ['mode C restores state after a conflict', testModeCConflict],
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

// Aはbranch refやHEADを変更せず、現在branchをPR headとして返す。
function testModeA(runRoot) {
  const history = createHistory(runRoot);
  const inventory = inventoryCommits(history.repo, history.base);
  const beforeHead = git(history.repo, ['rev-parse', 'HEAD']).stdout.trim();
  const prepared = prepareMode(
    history.repo,
    inventory,
    {
      mode: 'A',
      prs: [pr('all-content', history.commits, ['src/a.mjs', 'src/b.mjs', 'src/c.mjs'], 'none')],
    },
    'A',
  );

  const currentBranch = git(history.repo, ['branch', '--show-current']).stdout.trim();
  assert(prepared[0].preparedHead === currentBranch, JSON.stringify(prepared));
  assert(git(history.repo, ['rev-parse', 'HEAD']).stdout.trim() === beforeHead, prepared);
  assert(!branchExists(history.repo, 'pr-content/all-content'), prepared);
}

// local HEADが先行していても、delivery headのremote tracking refをA方式で再利用する。
function testModeAPartial(runRoot) {
  const history = createHistory(runRoot);
  const deliveryHead = history.commits[1];
  git(history.repo, ['update-ref', 'refs/remotes/origin/feature', deliveryHead]);
  const inventory = inventoryCommits(history.repo, history.base, 'refs/remotes/origin/feature');
  const plan = {
    mode: 'A',
    prs: [pr('partial-content', history.commits.slice(0, 2), ['src/a.mjs', 'src/b.mjs'], 'none')],
  };
  plan.prs[0].head = 'feature';
  const prepared = prepareMode(history.repo, inventory, plan, 'A');

  assert(prepared[0].head === 'feature', JSON.stringify(prepared));
  assert(prepared[0].expectedHead === deliveryHead, JSON.stringify(prepared));
  assert(inventory.deferredCommits[0].sha === history.commits[2], inventory);
  assert(git(history.repo, ['rev-parse', 'HEAD']).stdout.trim() === history.commits[2]);
}

// Bはcommit順を維持し、各範囲の末尾へ中間branchだけを作る。
function testModeB(runRoot) {
  const history = createHistory(runRoot);
  const inventory = inventoryCommits(history.repo, history.base);
  const prepared = prepareMode(
    history.repo,
    inventory,
    {
      mode: 'B',
      prs: [
        pr('first-content', [history.commits[0]], ['src/a.mjs'], 'intermediate'),
        pr(
          'remaining-content',
          history.commits.slice(1),
          ['src/b.mjs', 'src/c.mjs'],
          'intermediate',
        ),
      ],
    },
    'B',
  );

  assert(prepared[0].head === 'pr-content/first-content', JSON.stringify(prepared));
  assert(prepared[1].base === 'pr-content/first-content', JSON.stringify(prepared));
  assert(
    git(history.repo, ['rev-parse', prepared[1].head]).stdout.trim() === history.commits[2],
    JSON.stringify(prepared),
  );
}

// Cは現在branchを触らず、内容候補へ完全commitをcherry-pickする。
function testModeC(runRoot) {
  const history = createHistory(runRoot);
  const inventory = inventoryCommits(history.repo, history.base);
  const beforeHead = git(history.repo, ['rev-parse', 'HEAD']).stdout.trim();
  const prepared = prepareMode(
    history.repo,
    inventory,
    {
      mode: 'C',
      prs: [
        pr(
          'first-and-last',
          [history.commits[0], history.commits[2]],
          ['src/a.mjs', 'src/c.mjs'],
          'temporary-cherry-pick',
        ),
        pr('middle-content', [history.commits[1]], ['src/b.mjs'], 'temporary-cherry-pick'),
      ],
    },
    'C',
  );

  assert(prepared.length === 2, JSON.stringify(prepared));
  assert(prepared[0].sourceToPrepared[0].source === history.commits[0], JSON.stringify(prepared));
  assert(prepared[0].sourceToPrepared[1].prepared !== history.commits[2], JSON.stringify(prepared));
  assert(
    git(history.repo, ['worktree', 'list', '--porcelain']).stdout.trim().split('\n\n').length === 1,
  );
  assert(branchExists(history.repo, 'pr-content/first-and-last'), JSON.stringify(prepared));
  assert(
    git(history.repo, ['rev-parse', 'HEAD']).stdout.trim() === beforeHead,
    JSON.stringify(prepared),
  );
}

// cherry-pick conflictでは元HEAD、worktree、branch refを残さない。
function testModeCConflict(runRoot) {
  const history = createConflictHistory(runRoot);
  const inventory = inventoryCommits(history.repo, history.base);
  const beforeHead = git(history.repo, ['rev-parse', 'HEAD']).stdout.trim();
  let error;
  try {
    prepareMode(
      history.repo,
      inventory,
      {
        mode: 'C',
        prs: [
          pr(
            'conflict-content',
            [history.commits[1]],
            ['src/conflict.mjs'],
            'temporary-cherry-pick',
          ),
        ],
      },
      'C',
    );
  } catch (caughtError) {
    error = caughtError;
  }

  assert(error, 'expected cherry-pick conflict');
  assert(git(history.repo, ['rev-parse', 'HEAD']).stdout.trim() === beforeHead, error);
  assert(!branchExists(history.repo, 'pr-content/conflict-content'), error);
  assert(git(history.repo, ['status', '--porcelain']).stdout.trim() === '', error);
}

// 独立repoに3つのIntent commitを積み、各Pathを一commitへ限定する。
function createHistory(runRoot) {
  const repo = createRepo(runRoot);
  const base = git(repo, ['rev-parse', 'HEAD']).stdout.trim();
  const commits = [];
  for (const name of ['a', 'b', 'c']) {
    writeFileSync(join(repo, `src/${name}.mjs`), `export const ${name} = 1;\n`);
    git(repo, ['add', '--', `src/${name}.mjs`]);
    git(repo, ['commit', '-qm', validMessage(`Update ${name} Intent`)]);
    commits.push(git(repo, ['rev-parse', 'HEAD']).stdout.trim());
  }
  return { repo, base, commits };
}

// cherry-pick時に親との差分文脈が合わず、conflictになる履歴を作る。
function createConflictHistory(runRoot) {
  const repo = createRepo(runRoot);
  const base = git(repo, ['rev-parse', 'HEAD']).stdout.trim();
  writeFileSync(join(repo, 'src/conflict.mjs'), 'export const conflict = 1;\n');
  git(repo, ['add', '--', 'src/conflict.mjs']);
  git(repo, ['commit', '-qm', validMessage('Create conflict Intent')]);
  const first = git(repo, ['rev-parse', 'HEAD']).stdout.trim();
  writeFileSync(join(repo, 'src/conflict.mjs'), 'export const conflict = 2;\n');
  git(repo, ['add', '--', 'src/conflict.mjs']);
  git(repo, ['commit', '-qm', validMessage('Update conflict Intent')]);
  const second = git(repo, ['rev-parse', 'HEAD']).stdout.trim();
  return { repo, base, commits: [first, second] };
}

// source commitのmessage形式をfixtureへ揃える。
function validMessage(subject) {
  return [
    subject,
    '',
    'Why:',
    'prepare smokeで完全なIntent commitを検証するため。',
    '',
    'What:',
    '分離したPR候補を作成する。',
    '',
    'Verify:',
    '- prepare smokeを実行した。',
    '',
    'Co-authored-by: Cursor <cursoragent@cursor.com>',
  ].join('\n');
}

// Smoke用PR候補の共通フィールドを作る。
function pr(id, commits, paths, branchOperation) {
  return {
    id,
    intent: `${id}の候補を準備する`,
    behavior: `${id}の候補を確認できる状態になる`,
    commits,
    paths,
    base: 'HEAD~3',
    head: '<current-branch>',
    branchOperation,
    dependsOn: [],
    note: 'prepare smoke用のfixture。',
  };
}

// 最小の初期repositoryを作る。
function createRepo(runRoot) {
  const repo = mkdtempSync(join(runRoot, 'repo-'));
  mkdirSync(join(repo, 'src'), { recursive: true });
  for (const name of ['a', 'b', 'c']) {
    writeFileSync(join(repo, `src/${name}.mjs`), `export const ${name} = 0;\n`);
  }
  git(repo, ['init', '-q']);
  git(repo, ['add', '.']);
  git(repo, ['commit', '-qm', 'init']);
  return repo;
}

// branch refの存在だけを確認する。
function branchExists(repo, branch) {
  return git(repo, ['show-ref', '--verify', `refs/heads/${branch}`]).status === 0;
}

// fixture repoのGit操作を実行し、失敗をテスト失敗へ変換する。
function git(repo, args) {
  const result = spawnSync('git', args, {
    cwd: repo,
    encoding: 'utf8',
    env: process.env,
  });
  if (result.status !== 0 && args[0] !== 'show-ref') {
    throw new Error(`git ${args.join(' ')} failed: ${result.stderr}`);
  }
  return result;
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

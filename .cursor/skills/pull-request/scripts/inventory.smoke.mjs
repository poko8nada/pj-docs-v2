#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), 'inventory.mjs');
const ROOT = dirname(SCRIPT);

// 独立fixture repoでsource棚卸しとA/B/C proposal検証を実行する。
function main() {
  const runRoot = mkdtempSync(join(ROOT, '.inventory-smoke-'));
  const tests = [
    ['inventories linear Intent commits', testInventory],
    ['limits inventory to an explicit delivery head', testPartialDelivery],
    ['rejects Unit commits and dirty worktrees', testRejectsUnsafeSource],
    ['validates all three proposal modes', testProposalValidation],
    ['rejects duplicate, missing, path, and non-contiguous proposals', testProposalFailures],
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

// base..HEADのcommit順、Path、Git diff行数、Intent messageを棚卸しする。
function testInventory(runRoot) {
  const history = createHistory(runRoot);
  const result = runInventory(history.repo, history.base);

  assert(result.exitCode === 0, JSON.stringify(result));
  assert(result.status === 'inventoried', JSON.stringify(result));
  assert(result.commits.length === 3, JSON.stringify(result));
  assert(result.commits[0].parent === history.base, JSON.stringify(result));
  assert(result.commits[2].paths[0] === 'src/c.mjs', JSON.stringify(result));
  assert(
    result.commits.every((commit) => commit.message.includes('Why:\n')),
    result,
  );
  assert(result.lines === 6, JSON.stringify(result));
}

// 現在HEADより手前のdelivery headを指定し、後続commitをdeferredとして分離する。
function testPartialDelivery(runRoot) {
  const history = createHistory(runRoot);
  const deliveryHead = history.commits[1];
  const result = runInventory(history.repo, history.base, null, deliveryHead);

  assert(result.exitCode === 0, JSON.stringify(result));
  assert(result.head === deliveryHead, JSON.stringify(result));
  assert(result.commits.length === 2, JSON.stringify(result));
  assert(result.deferredCommits.length === 1, JSON.stringify(result));
  assert(result.deferredCommits[0].sha === history.commits[2], JSON.stringify(result));
}

// Unit commit、空範囲、dirty worktreeをPR候補のsourceとして許可しない。
function testRejectsUnsafeSource(runRoot) {
  const unitRepo = createRepo(runRoot);
  const base = git(unitRepo, ['rev-parse', 'HEAD']).stdout.trim();
  writeFileSync(join(unitRepo, 'src/a.mjs'), 'export const a = 1;\n');
  git(unitRepo, ['add', '--', 'src/a.mjs']);
  git(unitRepo, ['commit', '-qm', 'unit-a-unit-1: provisional change']);
  const unitResult = runInventory(unitRepo, base);

  assert(unitResult.exitCode !== 0, JSON.stringify(unitResult));
  assert(
    unitResult.message.includes('Intent integration requires a Why/What/Verify message'),
    JSON.stringify(unitResult),
  );

  const emptyRepo = createRepo(runRoot);
  const emptyBase = git(emptyRepo, ['rev-parse', 'HEAD']).stdout.trim();
  const emptyResult = runInventory(emptyRepo, emptyBase);
  assert(emptyResult.exitCode !== 0, JSON.stringify(emptyResult));
  assert(
    emptyResult.message.includes('contains no Intent integration commits'),
    JSON.stringify(emptyResult),
  );

  const dirtyRepo = createRepo(runRoot);
  const dirtyBase = git(dirtyRepo, ['rev-parse', 'HEAD']).stdout.trim();
  writeFileSync(join(dirtyRepo, 'src/a.mjs'), 'export const a = 1;\n');
  const dirtyResult = runInventory(dirtyRepo, dirtyBase);

  assert(dirtyResult.exitCode !== 0, JSON.stringify(dirtyResult));
  assert(dirtyResult.message.includes('clean worktree'), JSON.stringify(dirtyResult));
}

// 同じsource inventoryからA/B/C三案を検証し、各案のcommit被覆を確認する。
function testProposalValidation(runRoot) {
  const history = createHistory(runRoot);
  const proposals = buildProposals(history);
  const result = runInventory(history.repo, history.base, proposals);

  assert(result.exitCode === 0, JSON.stringify(result));
  assert(result.status === 'validated', JSON.stringify(result));
  assert(result.proposals.A.prCount === 1, JSON.stringify(result));
  assert(result.proposals.B.prCount === 2, JSON.stringify(result));
  assert(result.proposals.C.prCount === 2, JSON.stringify(result));
  assert(result.plan.proposals.A.prs.length === 1, JSON.stringify(result));
}

// commitの重複・漏れ、Path不一致、Bの非連続範囲を個別に拒否する。
function testProposalFailures(runRoot) {
  const history = createHistory(runRoot);
  const cases = [
    [
      'duplicate',
      (proposals) => {
        proposals.proposals.C.prs[0].commits = [history.commits[0], history.commits[0]];
        proposals.proposals.C.prs[0].paths = ['src/a.mjs'];
      },
      'repeats source commit',
    ],
    [
      'missing',
      (proposals) => {
        proposals.proposals.A.prs[0].commits = history.commits.slice(0, 2);
        proposals.proposals.A.prs[0].paths = ['src/a.mjs', 'src/b.mjs'];
      },
      'does not account for every source commit',
    ],
    [
      'paths',
      (proposals) => {
        proposals.proposals.A.prs[0].paths = ['src/a.mjs'];
      },
      'Paths do not match',
    ],
    [
      'non-contiguous',
      (proposals) => {
        proposals.proposals.B.prs[0].commits = [history.commits[0], history.commits[2]];
        proposals.proposals.B.prs[0].paths = ['src/a.mjs', 'src/c.mjs'];
      },
      'splits source order',
    ],
  ];

  for (const [label, mutate, expected] of cases) {
    const proposals = structuredClone(buildProposals(history));
    mutate(proposals);
    const result = runInventory(history.repo, history.base, proposals);
    assert(result.exitCode !== 0, `${label}: ${JSON.stringify(result)}`);
    assert(result.message.includes(expected), `${label}: ${JSON.stringify(result)}`);
  }
}

// base commitと3つのIntent統合commitを作り、各commitのPathを一つに固定する。
function createHistory(runRoot) {
  const repo = createRepo(runRoot);
  const base = git(repo, ['rev-parse', 'HEAD']).stdout.trim();
  const commits = [];

  for (const [name, value] of [
    ['a', 1],
    ['b', 1],
    ['c', 1],
  ]) {
    writeFileSync(join(repo, `src/${name}.mjs`), `export const ${name} = ${value};\n`);
    git(repo, ['add', '--', `src/${name}.mjs`]);
    git(repo, ['commit', '-qm', validMessage(`Update ${name} Intent`)]);
    commits.push(git(repo, ['rev-parse', 'HEAD']).stdout.trim());
  }

  return { repo, base, commits };
}

// source inventoryだけを検証するための初期Git repositoryを作る。
function createRepo(runRoot) {
  const repo = mkdtempSync(join(runRoot, 'repo-'));
  mkdirSync(join(repo, 'src'));
  writeFileSync(join(repo, 'src/a.mjs'), 'export const a = 0;\n');
  writeFileSync(join(repo, 'src/b.mjs'), 'export const b = 0;\n');
  writeFileSync(join(repo, 'src/c.mjs'), 'export const c = 0;\n');
  git(repo, ['init', '-q']);
  git(repo, ['add', '.']);
  git(repo, ['commit', '-qm', 'init']);
  return repo;
}

// A/B/Cで共有する、commit SkillのIntent message形式を作る。
function validMessage(subject) {
  return [
    subject,
    '',
    'Why:',
    'inventory smoke testでIntentを検証するため。',
    '',
    'What:',
    'source commitに一つの完全なレビュー境界を持たせる。',
    '',
    'Verify:',
    '- inventory smoke testを実行した。',
    '',
    'Co-authored-by: Cursor <cursoragent@cursor.com>',
  ].join('\n');
}

// 共通source inventoryから、3方式の完全なPR計画を組み立てる。
function buildProposals(history) {
  const [a, b, c] = history.commits;
  return {
    proposals: {
      A: {
        mode: 'A',
        prs: [
          pr(
            'all-content',
            'すべてのsmoke変更を接続する',
            'smoke対象の変更全体を確認できる状態になる',
            [a, b, c],
            ['src/a.mjs', 'src/b.mjs', 'src/c.mjs'],
            'none',
            [],
            history.base,
          ),
        ],
      },
      B: {
        mode: 'B',
        prs: [
          pr(
            'first-content',
            '最初の内容を更新する',
            '最初の内容を確認できる状態になる',
            [a],
            ['src/a.mjs'],
            'intermediate',
            [],
            history.base,
          ),
          pr(
            'remaining-content',
            '残りの内容を更新する',
            '残りの内容を確認できる状態になる',
            [b, c],
            ['src/b.mjs', 'src/c.mjs'],
            'intermediate',
            ['first-content'],
            history.base,
          ),
        ],
      },
      C: {
        mode: 'C',
        prs: [
          pr(
            'first-and-last',
            '最初と最後の内容をまとめる',
            '関連する端点を確認できる状態になる',
            [a, c],
            ['src/a.mjs', 'src/c.mjs'],
            'temporary-cherry-pick',
            [],
            history.base,
          ),
          pr(
            'middle-content',
            '中央の内容をまとめる',
            '中央の内容を確認できる状態になる',
            [b],
            ['src/b.mjs'],
            'temporary-cherry-pick',
            [],
            history.base,
          ),
        ],
      },
    },
  };
}

// PR候補の共通フィールドを作り、テストデータの重複を減らす。
function pr(
  id,
  intent,
  behavior,
  commits,
  paths,
  branchOperation,
  dependsOn = [],
  base = 'develop',
) {
  return {
    id,
    intent,
    behavior,
    commits,
    paths,
    base,
    head: `${id}-branch`,
    branchOperation,
    dependsOn,
    note: 'inventory smoke用のfixture。',
  };
}

// inventory scriptを子プロセスで実行し、stdoutのJSONを返す。
function runInventory(repo, base, proposals = null, head = null) {
  const args = [SCRIPT, '--root', repo, '--base', base];
  if (head) args.push('--head', head);
  let input;
  if (proposals) {
    args.push('--proposal-stdin');
    input = `${JSON.stringify(proposals)}\n`;
  }
  const result = spawnSync(process.execPath, args, {
    cwd: repo,
    encoding: 'utf8',
    input,
  });
  return { ...parseJson(result.stdout), exitCode: result.status };
}

// Git fixtureのauthor情報を環境変数で与え、global/local configを変更しない。
function git(repo, args) {
  const result = spawnSync('git', args, {
    cwd: repo,
    encoding: 'utf8',
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: 'Pull Request Inventory Smoke',
      GIT_AUTHOR_EMAIL: 'pull-request-inventory@example.invalid',
      GIT_COMMITTER_NAME: 'Pull Request Inventory Smoke',
      GIT_COMMITTER_EMAIL: 'pull-request-inventory@example.invalid',
    },
  });
  if (result.status !== 0) throw new Error(`git ${args.join(' ')} failed: ${result.stderr}`);
  return result;
}

// 子プロセスのJSON契約違反をstdout込みで報告する。
function parseJson(output) {
  try {
    return JSON.parse(String(output || '{}'));
  } catch (error) {
    throw new Error(`Expected JSON output: ${errorMessage(error)}\n${output}`, { cause: error });
  }
}

// テスト失敗時に期待値と実際の出力を同時に確認できるようにする。
function assert(condition, detail) {
  if (!condition) throw new Error(`assertion failed: ${detail}`);
}

// Errorと通常値を一つの表示形式へ変換する。
function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

main();

#!/usr/bin/env node

import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  utimesSync,
  writeFileSync,
} from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { REVIEW_ARTIFACT_MAX_AGE_MS } from './lib/artifact.mjs';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REVIEW_SCRIPT = join(SCRIPT_DIR, 'review.mjs');
const COMMIT_SCRIPT = join(SCRIPT_DIR, 'commit.mjs');
const MEASURE_SCRIPT = join(SCRIPT_DIR, 'measure.mjs');
const INTEGRATE_SCRIPT = join(SCRIPT_DIR, 'integrate.mjs');
const TMP_ROOT = join(SCRIPT_DIR, '.tmp');

// 一時Gitリポジトリを使って、レビュー・計測・commit・統合の契約を順に検証する。
function main() {
  mkdirSync(TMP_ROOT, { recursive: true });
  const runRoot = mkdtempSync(join(TMP_ROOT, 'smoke-'));
  const tests = [
    ['review creates a complete payload artifact', testReviewRequired],
    ['review blocks on local check warnings and errors', testReviewChecksFailure],
    ['review includes explicit context files', testReviewContext],
    ['review notes are included in the artifact', testReviewNotes],
    ['large existing and new files are not truncated', testReviewFullDiff],
    ['measure accepts a single Intent without a Unit', testMeasureSingleIntent],
    ['measure rejects mixed Intent and Unit shapes', testMeasureRejectsMixedIntentShape],
    ['measure reports rows without changing the index', testMeasurePlan],
    ['measure reports line counts without splitting', testMeasureLargeUnit],
    ['measure rejects duplicate paths', testMeasureDuplicatePaths],
    ['measure rejects unplanned paths', testMeasureUnplannedPaths],
    ['measure rejects dirty context files', testMeasureDirtyContext],
    ['stale artifacts are removed across conversation IDs', testStaleArtifacts],
    ['non-reviewable candidate skips reviewer', testNoReviewRequired],
    ['missing hash rejects commit', testMissingHash],
    ['invalid hash rejects commit', testInvalidHash],
    ['invalid commit message rejects commit', testInvalidCommitMessage],
    ['message correction reuses review artifacts', testMessageRetry],
    ['unit commit message is accepted', testUnitCommit],
    ['intent integration preserves the final tree', testIntentIntegration],
    ['batch intent integration creates one commit per Intent', testBatchIntentIntegration],
    ['intent manifest validation rejects invalid input', testIntentManifestValidation],
    ['intent integration rejects unsafe history operations', testIntentIntegrationFailures],
    ['hash mismatch rejects commit', testHashMismatch],
    ['hook failure retries only for an unchanged candidate', testHookFailureRetry],
    ['verified candidate commits and cleans artifacts', testCommit],
    ['cleanup failure is reported separately', testCleanupFailure],
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

// review_requiredが完全なpayload artifactとhashを作ることを確認する。
function testReviewRequired(runRoot) {
  const id = 'smoke-review-required';
  const repo = createRepo(runRoot, {
    changedContent: 'export const value = 2;\n',
    packageScripts: passingCheckScripts(),
  });
  const result = runReview(repo, id);

  assert(result.exitCode === 0, JSON.stringify(result));
  assert(result.status === 'review_required', JSON.stringify(result));
  assert(result.complete === true, JSON.stringify(result));
  assert(result.request?.subagent_type === 'pre-commit-reviewer', JSON.stringify(result));
  assert(result.request.prompt.includes('[commit-review-artifact]'), result.request?.prompt);
  assert(result.request.prompt.includes(result.requestArtifact), result.request?.prompt);

  const payload = readArtifact(repo, id, 'request');
  assert(payload.startsWith('[commit-review-payload]'), payload);
  assert(payload.includes('src/change.mjs'), payload);
  assert(!payload.includes('truncated'), payload);
  assert(readArtifact(repo, id, 'hash').startsWith('sha256:'), result);
  assert(readArtifact(repo, id, 'result') === 'review_required', result);
  assert(
    result.checks
      ?.filter((check) => check.paths.length > 0)
      .every((check) => check.status === 'passed'),
    JSON.stringify(result),
  );
}

// warning/errorを検出したcandidateではreviewerを起動せずartifactも作らないことを確認する。
function testReviewChecksFailure(runRoot) {
  const id = 'smoke-review-checks-failure';
  const repo = createRepo(runRoot, {
    changedContent: 'export const value = 2;\n',
    packageScripts: {
      ...passingCheckScripts(),
      lint: "printf 'warning from lint\\n'; exit 1",
    },
  });
  const result = runReview(repo, id);

  assert(result.exitCode !== 0, JSON.stringify(result));
  assert(result.status === 'checks_failed', JSON.stringify(result));
  const lint = result.checks?.find((check) => check.name === 'lint');
  assert(lint?.status === 'failed', JSON.stringify(result));
  assert(lint.warnings.length > 0, JSON.stringify(result));
  assert(lint.errors.length > 0, JSON.stringify(result));
  assert(!artifactExists(repo, id, 'hash'), JSON.stringify(result));
  assert(!artifactExists(repo, id, 'result'), JSON.stringify(result));
  assert(!artifactExists(repo, id, 'request'), JSON.stringify(result));
}

// Contextはpayloadに一覧だけ入り、diff対象にはならないことを確認する。
function testReviewContext(runRoot) {
  const id = 'smoke-review-context';
  const repo = createRepo(runRoot, { changedContent: 'export const value = 2;\n' });
  const result = runReview(repo, id, ['--context', 'README.md']);
  const payload = readArtifact(repo, id, 'request');

  assert(result.exitCode === 0, JSON.stringify(result));
  assert(result.contextPaths?.length === 1, JSON.stringify(result));
  assert(result.contextPaths[0] === 'README.md', JSON.stringify(result));
  assert(payload.includes('Context Files:\n- README.md'), payload);
  assert(!payload.includes('### README.md'), payload);
}

// ユーザー注記がReview notesとしてpayloadへ渡ることを確認する。
function testReviewNotes(runRoot) {
  const id = 'smoke-review-note';
  const repo = createRepo(runRoot, { changedContent: 'export const value = 2;\n' });
  const result = runReview(repo, id, ['--note', 'Harness verifies PASS before commit.']);
  const payload = readArtifact(repo, id, 'request');

  assert(result.exitCode === 0, JSON.stringify(result));
  assert(payload.includes('Review notes:\nHarness verifies PASS before commit.'), payload);
}

// 既存ファイルと新規ファイルのdiffが切り詰められず残ることを確認する。
function testReviewFullDiff(runRoot) {
  const id = 'smoke-review-full-diff';
  const repo = createRepo(runRoot, { stagedFiles: [] });
  const existing = Array.from({ length: 2_000 }, (_, index) => `// existing ${index}\n`).join('');
  const added = Array.from({ length: 2_000 }, (_, index) => `// added ${index}\n`).join('');
  writeFileSync(join(repo, 'src/change.mjs'), existing);
  writeFileSync(join(repo, 'src/new-file.mjs'), added);
  runGit(repo, ['add', '--', 'src/change.mjs', 'src/new-file.mjs']);

  const result = runReview(repo, id);
  const payload = readArtifact(repo, id, 'request');

  assert(result.exitCode === 0, JSON.stringify(result));
  assert(result.status === 'review_required', JSON.stringify(result));
  assert(payload.includes('// existing 1999'), payload);
  assert(payload.includes('+// added 1999'), payload);
  assert(!payload.includes('[This file section was truncated.]'), payload);
  assert(!payload.includes('[omitted remaining'), payload);
}

// Unitsなしの単一Intentを解析し、Intent commit行として計測できることを確認する。
function testMeasureSingleIntent(runRoot) {
  const id = 'smoke-measure-single-intent';
  const repo = createRepo(runRoot, { changedContent: 'export const value = 2;\n' });
  const plan = [
    '- Intent: Deliver one complete change',
    '  - Behavior: The staged export is updated as one final Intent',
    '  - Paths:',
    '    - `src/change.mjs`',
    '  - Context:',
    '    - `src/context.mjs`',
    '  - Review: required',
    '  - Lines: pending',
    '  - Note: —',
  ].join('\n');
  const before = runGit(repo, ['diff', '--cached', '--name-only']).stdout;
  const result = runMeasure(repo, id, ['--plan-stdin'], plan);
  const after = runGit(repo, ['diff', '--cached', '--name-only']).stdout;

  assert(result.exitCode === 0, JSON.stringify(result));
  assert(result.status === 'measured', JSON.stringify(result));
  assert(before === after, 'measure.mjs changed the staged index');
  assert(result.rows.length === 1, JSON.stringify(result));
  assert(result.rows[0].unit === null, JSON.stringify(result));
  assert(result.rows[0].commit === 'intent', JSON.stringify(result));
  assert(result.rows[0].context[0] === 'src/context.mjs', JSON.stringify(result));
  assert(result.rows[0].lines === 2, JSON.stringify(result));
}

// direct fieldsとUnitsの混在を計画構造エラーとして拒否することを確認する。
function testMeasureRejectsMixedIntentShape(runRoot) {
  const id = 'smoke-measure-mixed-intent';
  const repo = createRepo(runRoot, { changedContent: 'export const value = 2;\n' });
  const plan = [
    '- Intent: Reject mixed shape',
    '  - Behavior: A plan cannot combine direct fields and Units',
    '  - Paths:',
    '    - `src/change.mjs`',
    '  - Review: required',
    '  - Units:',
    '    - Unit: reject-mixed-shape-unit-1',
    '      - Paths:',
    '        - `src/change.mjs`',
    '      - Review: required',
    '      - Lines: pending',
  ].join('\n');
  const result = runMeasure(repo, id, ['--plan-stdin'], plan);

  assert(result.exitCode !== 0, JSON.stringify(result));
  assert(
    String(result.message).includes('cannot mix direct fields with Units'),
    JSON.stringify(result),
  );
}

// 複数Unit、Context、review分類を含む計画がindexを変更せず計測されることを確認する。
function testMeasurePlan(runRoot) {
  const id = 'smoke-measure-plan';
  const repo = createRepo(runRoot, {
    stagedFiles: ['src/change.mjs', 'README.md'],
    changedContent: 'export const value = 2;\n',
  });
  const plan = [
    '- Intent: Keep code and documentation aligned',
    '  - Behavior: The staged candidate describes one coherent update',
    '  - Units:',
    '    - Unit: keep-code-and-documentation-unit-1',
    '      - Paths:',
    '        - `src/change.mjs`',
    '      - Context:',
    '        - `src/context.mjs`',
    '      - Review: required',
    '      - Lines: pending',
    '      - Note: Agreed design context',
    '    - Unit: keep-code-and-documentation-unit-2',
    '      - Paths:',
    '        - `README.md`',
    '      - Review: no_review_required',
    '      - Lines: —',
    '      - Note: —',
  ].join('\n');
  const before = runGit(repo, ['diff', '--cached', '--name-only']).stdout;
  const result = runMeasure(repo, id, ['--plan-stdin'], plan);
  const after = runGit(repo, ['diff', '--cached', '--name-only']).stdout;

  assert(result.exitCode === 0, JSON.stringify(result));
  assert(result.status === 'measured', JSON.stringify(result));
  assert(before === after, 'measure.mjs changed the staged index');
  assert(result.rows.length === 2, JSON.stringify(result));
  assert(result.rows[0].lines === 2, JSON.stringify(result));
  assert(result.rows[0].files[0].additions === 1, JSON.stringify(result));
  assert(result.rows[0].files[0].deletions === 1, JSON.stringify(result));
  assert(result.rows[0].note === 'Agreed design context', JSON.stringify(result));
  assert(result.rows[0].context[0] === 'src/context.mjs', JSON.stringify(result));
  assert(result.rows[1].review === 'no_review_required', JSON.stringify(result));
  assert(result.rows[1].lines === null, JSON.stringify(result));
}

// 複数ファイルのGit diff行数を合算するが、分割判断はSkillへ残すことを確認する。
function testMeasureLargeUnit(runRoot) {
  const id = 'smoke-measure-large-unit';
  const repo = createRepo(runRoot, { stagedFiles: [] });
  for (const [index, path] of ['src/large-a.mjs', 'src/large-b.mjs'].entries()) {
    writeFileSync(
      join(repo, path),
      `export const file${index} = true;\n` + '// content\n'.repeat(1_000),
    );
    runGit(repo, ['add', '--', path]);
  }
  const plan = [
    '- Intent: Keep related modules together',
    '  - Behavior: Both module exports remain available',
    '  - Units:',
    '    - Unit: related-modules-unit-1',
    '      - Paths:',
    '        - `src/large-a.mjs`',
    '        - `src/large-b.mjs`',
    '      - Review: required',
    '      - Lines: pending',
    '      - Note: —',
  ].join('\n');
  const result = runMeasure(repo, id, ['--plan-stdin'], plan);

  assert(result.exitCode === 0, JSON.stringify(result));
  assert(result.status === 'measured', JSON.stringify(result));
  assert(result.rows[0].lines > 1_200, JSON.stringify(result));
  assert(!Object.hasOwn(result.rows[0], 'canSplit'), JSON.stringify(result));
  assert(!Object.hasOwn(result.rows[0], 'stopReason'), JSON.stringify(result));
}

// 一つのPathを複数Unitへ重複配置した計画を拒否することを確認する。
function testMeasureDuplicatePaths(runRoot) {
  const id = 'smoke-measure-duplicate';
  const repo = createRepo(runRoot, { changedContent: 'export const value = 2;\n' });
  const plan = [
    '- Intent: Split one change incorrectly',
    '  - Behavior: The same path appears twice',
    '  - Units:',
    '    - Unit: duplicate-path-unit-1',
    '      - Paths:',
    '        - `src/change.mjs`',
    '      - Review: required',
    '      - Lines: pending',
    '      - Note: —',
    '    - Unit: duplicate-path-unit-2',
    '      - Paths:',
    '        - `src/change.mjs`',
    '      - Review: required',
    '      - Lines: pending',
    '      - Note: —',
  ].join('\n');
  const result = runMeasure(repo, id, ['--plan-stdin'], plan);

  assert(result.exitCode !== 0, JSON.stringify(result));
  assert(result.status === 'error', JSON.stringify(result));
  assert(result.message.includes('Path appears more than once'), JSON.stringify(result));
}

// staged candidateに存在する未計画Pathを見逃さないことを確認する。
function testMeasureUnplannedPaths(runRoot) {
  const id = 'smoke-measure-unplanned';
  const repo = createRepo(runRoot, {
    stagedFiles: ['src/change.mjs', 'README.md'],
    changedContent: 'export const value = 2;\n',
  });
  const plan = [
    '- Intent: Keep the code',
    '  - Behavior: The export remains updated',
    '  - Units:',
    '    - Unit: keep-code-unit-1',
    '      - Paths:',
    '        - `src/change.mjs`',
    '      - Review: required',
    '      - Lines: pending',
    '      - Note: —',
  ].join('\n');
  const result = runMeasure(repo, id, ['--plan-stdin'], plan);

  assert(result.exitCode !== 0, JSON.stringify(result));
  assert(result.status === 'error', JSON.stringify(result));
  assert(result.message.includes('Staged path is not planned'), JSON.stringify(result));
}

// 変更中のContextを読み取り専用の補助資料として許可しないことを確認する。
function testMeasureDirtyContext(runRoot) {
  const id = 'smoke-measure-dirty-context';
  const repo = createRepo(runRoot, { changedContent: 'export const value = 2;\n' });
  writeFileSync(join(repo, 'src/context.mjs'), 'export const context = false;\n');
  const plan = [
    '- Intent: Keep the code',
    '  - Behavior: The export remains updated',
    '  - Units:',
    '    - Unit: keep-code-unit-1',
    '      - Paths:',
    '        - `src/change.mjs`',
    '      - Context:',
    '        - `src/context.mjs`',
    '      - Review: required',
    '      - Lines: pending',
    '      - Note: —',
  ].join('\n');
  const result = runMeasure(repo, id, ['--plan-stdin'], plan);

  assert(result.exitCode !== 0, JSON.stringify(result));
  assert(result.status === 'error', JSON.stringify(result));
  assert(result.message.includes('Context path has uncommitted changes'), JSON.stringify(result));
}

// conversation IDが異なっても期限切れartifactをmtimeで掃除することを確認する。
function testStaleArtifacts(runRoot) {
  const oldId = 'smoke-stale-artifacts';
  const currentId = 'smoke-current-artifacts';
  const repo = createRepo(runRoot, { changedContent: 'export const value = 2;\n' });
  const oldReview = runReview(repo, oldId);
  assert(oldReview.status === 'review_required', oldReview);

  const oldTime = new Date(Date.now() - REVIEW_ARTIFACT_MAX_AGE_MS - 1_000);
  for (const kind of ['hash', 'result', 'request']) {
    const path = artifactPath(repo, oldId, kind);
    utimesSync(path, oldTime, oldTime);
  }

  const currentReview = runReview(repo, currentId);
  assert(currentReview.exitCode === 0, JSON.stringify(currentReview));
  for (const kind of ['hash', 'result', 'request']) {
    assert(!artifactExists(repo, oldId, kind), `${oldId}.${kind} was not removed`);
  }
  assert(artifactExists(repo, currentId, 'request'), currentReview);
}

// 非レビュー対象だけのcandidateではreviewer requestを作らないことを確認する。
function testNoReviewRequired(runRoot) {
  const id = 'smoke-no-review';
  const repo = createRepo(runRoot, {
    stagedFiles: ['README.md'],
    changedContent: '# changed smoke README\n',
  });
  const result = runReview(repo, id);

  assert(result.exitCode === 0, JSON.stringify(result));
  assert(result.status === 'no_review_required', JSON.stringify(result));
  assert(!result.request, JSON.stringify(result));
  assert(!artifactExists(repo, id, 'request'), JSON.stringify(result));
  assert(readArtifact(repo, id, 'result') === 'no_review_required', result);
}

// review結果がなくhashもない状態でcommitを拒否することを確認する。
function testMissingHash(runRoot) {
  const id = 'smoke-missing-hash';
  const repo = createRepo(runRoot, {
    stagedFiles: ['README.md'],
    changedContent: '# missing hash\n',
  });
  const result = runCommit(repo, id, validCommitMessage('Reject missing hash'));

  assert(result.exitCode !== 0, JSON.stringify(result));
  assert(result.status === 'rejected', JSON.stringify(result));
  assert(String(result.message).includes('Review hash is missing'), JSON.stringify(result));
}

// hash artifactの形式が壊れている場合にcommitを拒否することを確認する。
function testInvalidHash(runRoot) {
  const id = 'smoke-invalid-hash';
  const repo = createRepo(runRoot, { stagedFiles: [] });
  mkdirSync(join(repo, '.cursor/skills/commit/scripts/.tmp'), { recursive: true });
  writeFileSync(artifactPath(repo, id, 'hash'), 'not-a-sha256-hash\n');

  const result = runCommit(repo, id, validCommitMessage('Reject invalid hash'));
  assert(result.exitCode !== 0, JSON.stringify(result));
  assert(result.status === 'rejected', JSON.stringify(result));
  assert(String(result.message).includes('stored hash is invalid'), JSON.stringify(result));
}

// Why/What/VerifyとUnit subjectの各構造エラーをcommit前に拒否することを確認する。
function testInvalidCommitMessage(runRoot) {
  const messages = [
    ['missing-sections', 'not a structured commit message'],
    [
      'empty-why',
      [
        'Invalid empty why',
        '',
        'Why:',
        '',
        '',
        'What:',
        'Some change.',
        '',
        'Verify:',
        '- smoke',
      ].join('\n'),
    ],
    [
      'verify-without-check',
      [
        'Invalid verify',
        '',
        'Why:',
        'Some reason.',
        '',
        'What:',
        'Some change.',
        '',
        'Verify:',
        'Manual verification only.',
      ].join('\n'),
    ],
    ['invalid-unit-body', 'unit-review-evidence-unit-1: connect evidence\n\nWhy:\nnot allowed'],
  ];

  for (const [label, message] of messages) {
    const id = `smoke-invalid-message-${label}`;
    const repo = createRepo(runRoot, {
      stagedFiles: ['README.md'],
      changedContent: `# ${label}\n`,
    });
    const review = runReview(repo, id);
    const result = runCommit(repo, id, message);
    assert(review.status === 'no_review_required', review);
    assert(result.exitCode !== 0, JSON.stringify(result));
    assert(result.status === 'rejected', JSON.stringify(result));
    assert(result.retryable === true, JSON.stringify(result));
    assert(result.retryReason === 'message_validation', JSON.stringify(result));
    assert(result.artifacts?.preserved === true, JSON.stringify(result));
    assert(artifactExists(repo, id, 'hash'), JSON.stringify(result));
    assert(artifactExists(repo, id, 'result'), JSON.stringify(result));
  }
}

// messageだけを修正した再commitではreviewを再実行せず、長いsubjectはwarningとして通すことを確認する。
function testMessageRetry(runRoot) {
  const id = 'smoke-message-retry';
  const repo = createRepo(runRoot, {
    changedContent: 'export const value = 2;\n',
  });
  const review = runReview(repo, id);
  const invalid = runCommit(repo, id, 'invalid message');

  assert(review.status === 'review_required', review);
  assert(invalid.exitCode !== 0, JSON.stringify(invalid));
  assert(invalid.retryable === true, JSON.stringify(invalid));
  assert(artifactExists(repo, id, 'hash'), JSON.stringify(invalid));
  assert(artifactExists(repo, id, 'result'), JSON.stringify(invalid));
  assert(artifactExists(repo, id, 'request'), JSON.stringify(invalid));

  const longMessage = [
    'x'.repeat(73),
    '',
    'Why:',
    'Some reason.',
    '',
    'What:',
    'Some change.',
    '',
    'Verify:',
    '- smoke',
  ].join('\n');
  const retried = runCommit(repo, id, longMessage);
  assert(retried.exitCode === 0, JSON.stringify(retried));
  assert(retried.status === 'committed', JSON.stringify(retried));
  assert(
    retried.warnings?.some((warning) => warning.includes('recommended 72')),
    JSON.stringify(retried),
  );
  assert(!artifactExists(repo, id, 'hash'), JSON.stringify(retried));
  assert(!artifactExists(repo, id, 'result'), JSON.stringify(retried));
  assert(!artifactExists(repo, id, 'request'), JSON.stringify(retried));
}

// no_review_requiredのUnitが機械的なUnit subjectでcommitできることを確認する。
function testUnitCommit(runRoot) {
  const id = 'smoke-unit-commit';
  const repo = createRepo(runRoot, {
    stagedFiles: ['README.md'],
    changedContent: '# committed Unit README\n',
  });
  const review = runReview(repo, id);
  const result = runCommit(
    repo,
    id,
    'unit-review-evidence-review-evidence-unit-1: connect review evidence',
  );
  const log = runGit(repo, ['log', '-1', '--format=%B']).stdout;

  assert(review.status === 'no_review_required', review);
  assert(result.exitCode === 0, JSON.stringify(result));
  assert(result.status === 'committed', JSON.stringify(result));
  assert(log.includes('unit-review-evidence-review-evidence-unit-1:'), log);
  assert(log.includes('Co-authored-by: Cursor <cursoragent@cursor.com>'), log);
}

// 連続したUnit履歴を一つのIntent commitへ統合してtreeを保つことを確認する。
function testIntentIntegration(runRoot) {
  const id = 'smoke-intent-integration';
  const repo = createRepo(runRoot, { stagedFiles: [] });
  const base = runGit(repo, ['rev-parse', 'HEAD']).stdout.trim();

  writeFileSync(join(repo, 'src/change.mjs'), 'export const value = 2;\n');
  runGit(repo, ['add', '--', 'src/change.mjs']);
  runGit(repo, [
    'commit',
    '-qm',
    'unit-review-evidence-review-evidence-unit-1: connect review evidence',
  ]);
  const firstUnit = runGit(repo, ['rev-parse', 'HEAD']).stdout.trim();

  writeFileSync(join(repo, 'README.md'), '# integrated smoke README\n');
  runGit(repo, ['add', '--', 'README.md']);
  runGit(repo, [
    'commit',
    '-qm',
    'unit-review-evidence-review-evidence-unit-2: connect review evidence',
  ]);
  const secondUnit = runGit(repo, ['rev-parse', 'HEAD']).stdout.trim();
  const beforeTree = runGit(repo, ['rev-parse', 'HEAD^{tree}']).stdout.trim();

  const result = runIntegrate(
    repo,
    id,
    base,
    `${firstUnit},${secondUnit}`,
    validCommitMessage('Integrate review evidence'),
  );
  const afterTree = runGit(repo, ['rev-parse', 'HEAD^{tree}']).stdout.trim();
  const count = runGit(repo, ['rev-list', '--count', `${base}..HEAD`]).stdout.trim();
  const log = runGit(repo, ['log', '-1', '--format=%B']).stdout;

  assert(result.exitCode === 0, JSON.stringify(result));
  assert(result.status === 'integrated', JSON.stringify(result));
  assert(result.tree === beforeTree, JSON.stringify(result));
  assert(afterTree === beforeTree, `${beforeTree} !== ${afterTree}`);
  assert(count === '1', count);
  assert(log.includes('Integrate review evidence'), log);
  assert(log.includes('Co-authored-by: Cursor <cursoragent@cursor.com>'), log);
}

// 複数Intentと単一Intentを一括統合し、Intentごとに最終commitが残ることを確認する。
function testBatchIntentIntegration(runRoot) {
  const id = 'smoke-batch-intent-integration';
  const repo = createRepo(runRoot, { stagedFiles: [] });
  const base = runGit(repo, ['rev-parse', 'HEAD']).stdout.trim();
  const groups = [];

  for (const [intent, prefix] of [
    ['Align review evidence', 'evidence'],
    ['Finalize commit workflow', 'workflow'],
  ]) {
    const commits = [];
    for (let index = 0; index < 2; index += 1) {
      const path = `src/${prefix}-${index + 1}.mjs`;
      writeFileSync(join(repo, path), `export const ${prefix}${index + 1} = true;\n`);
      runGit(repo, ['add', '--', path]);
      runGit(repo, ['commit', '-qm', `unit-${prefix}-unit-${index + 1}: stage ${prefix} change`]);
      commits.push(runGit(repo, ['rev-parse', 'HEAD']).stdout.trim());
    }
    groups.push({
      intent,
      mode: 'unit',
      commits,
      message: validCommitMessage(intent),
    });
  }

  writeFileSync(join(repo, 'README.md'), '# direct Intent smoke fixture\n');
  runGit(repo, ['add', '--', 'README.md']);
  runGit(repo, ['commit', '-qm', validCommitMessage('Document final Intent')]);
  groups.push({
    intent: 'Document final Intent',
    mode: 'intent',
    commits: [runGit(repo, ['rev-parse', 'HEAD']).stdout.trim()],
    message: validCommitMessage('Document final Intent'),
  });

  const beforeTree = runGit(repo, ['rev-parse', 'HEAD^{tree}']).stdout.trim();
  const result = runBatchIntegrate(repo, id, base, groups);
  const afterTree = runGit(repo, ['rev-parse', 'HEAD^{tree}']).stdout.trim();
  const count = runGit(repo, ['rev-list', '--count', `${base}..HEAD`]).stdout.trim();
  const subjects = runGit(repo, ['log', '--format=%s', `${base}..HEAD`])
    .stdout.trim()
    .split('\n');

  assert(result.exitCode === 0, JSON.stringify(result));
  assert(result.status === 'integrated', JSON.stringify(result));
  assert(result.intentCommits.length === 3, JSON.stringify(result));
  assert(result.tree === beforeTree, JSON.stringify(result));
  assert(afterTree === beforeTree, `${beforeTree} !== ${afterTree}`);
  assert(count === '3', count);
  assert(subjects[0] === 'Document final Intent', subjects.join('\n'));
  assert(subjects[1] === 'Finalize commit workflow', subjects.join('\n'));
  assert(subjects[2] === 'Align review evidence', subjects.join('\n'));
}

// manifestの入力境界とIntent modeのcommit数制約を、履歴操作前に拒否することを確認する。
function testIntentManifestValidation(runRoot) {
  const invalidJsonRepo = createRepo(runRoot, { stagedFiles: [] });
  const invalidJsonBase = runGit(invalidJsonRepo, ['rev-parse', 'HEAD']).stdout.trim();
  const invalidJson = runRawIntegrate(
    invalidJsonRepo,
    'smoke-manifest-invalid-json',
    invalidJsonBase,
    '{',
  );
  assert(invalidJson.exitCode !== 0, JSON.stringify(invalidJson));
  assert(String(invalidJson.message).includes('not valid JSON'), JSON.stringify(invalidJson));

  const emptyManifestRepo = createRepo(runRoot, { stagedFiles: [] });
  const emptyManifestBase = runGit(emptyManifestRepo, ['rev-parse', 'HEAD']).stdout.trim();
  const emptyManifest = runRawIntegrate(
    emptyManifestRepo,
    'smoke-manifest-empty',
    emptyManifestBase,
    JSON.stringify({ groups: [] }),
  );
  assert(emptyManifest.exitCode !== 0, JSON.stringify(emptyManifest));
  assert(
    String(emptyManifest.message).includes('at least one group'),
    JSON.stringify(emptyManifest),
  );

  const invalidGroupRepo = createRepo(runRoot, { stagedFiles: [] });
  const invalidGroupBase = runGit(invalidGroupRepo, ['rev-parse', 'HEAD']).stdout.trim();
  const invalidGroup = runRawIntegrate(
    invalidGroupRepo,
    'smoke-manifest-invalid-group',
    invalidGroupBase,
    JSON.stringify({ groups: [null] }),
  );
  assert(invalidGroup.exitCode !== 0, JSON.stringify(invalidGroup));
  assert(String(invalidGroup.message).includes('group 1 is invalid'), JSON.stringify(invalidGroup));

  const invalidModeRepo = createRepo(runRoot, { stagedFiles: [] });
  const invalidModeBase = runGit(invalidModeRepo, ['rev-parse', 'HEAD']).stdout.trim();
  const invalidMode = runRawIntegrate(
    invalidModeRepo,
    'smoke-manifest-invalid-mode',
    invalidModeBase,
    JSON.stringify({
      groups: [{ intent: 'Invalid mode', mode: 'other', commits: ['HEAD'], message: 'invalid' }],
    }),
  );
  assert(invalidMode.exitCode !== 0, JSON.stringify(invalidMode));
  assert(
    String(invalidMode.message).includes('mode "unit" or "intent"'),
    JSON.stringify(invalidMode),
  );

  const missingCommitsRepo = createRepo(runRoot, { stagedFiles: [] });
  const missingCommitsBase = runGit(missingCommitsRepo, ['rev-parse', 'HEAD']).stdout.trim();
  const missingCommits = runRawIntegrate(
    missingCommitsRepo,
    'smoke-manifest-missing-commits',
    missingCommitsBase,
    JSON.stringify({
      groups: [{ intent: 'Missing commits', mode: 'unit', message: 'invalid' }],
    }),
  );
  assert(missingCommits.exitCode !== 0, JSON.stringify(missingCommits));
  assert(String(missingCommits.message).includes('needs commits'), JSON.stringify(missingCommits));

  const multiIntent = createUnitHistory(runRoot, 2);
  const multiIntentMessage = validCommitMessage('Already final Intent');
  const multiIntentResult = runRawIntegrate(
    multiIntent.repo,
    'smoke-manifest-multiple-intent-commits',
    multiIntent.base,
    JSON.stringify({
      groups: [
        {
          intent: 'Already final Intent',
          mode: 'intent',
          commits: multiIntent.commits,
          message: multiIntentMessage,
        },
      ],
    }),
  );
  assert(multiIntentResult.exitCode !== 0, JSON.stringify(multiIntentResult));
  assert(
    String(multiIntentResult.message).includes('exactly one source commit'),
    JSON.stringify(multiIntentResult),
  );
}

// dirty、重複、非連続、hook失敗、tree改変を安全に拒否・復旧することを確認する。
function testIntentIntegrationFailures(runRoot) {
  // 履歴操作の拒否と復旧経路を、実際のGit状態で確認する。
  const dirty = createUnitHistory(runRoot, 2);
  writeFileSync(join(dirty.repo, 'README.md'), '# dirty integration worktree\n');
  const dirtyResult = runIntegrate(
    dirty.repo,
    'smoke-intent-integration-dirty',
    dirty.base,
    dirty.commits.join(','),
    validCommitMessage('Reject dirty integration'),
  );
  assert(dirtyResult.exitCode !== 0, JSON.stringify(dirtyResult));
  assert(
    String(dirtyResult.message).includes('requires a clean worktree'),
    JSON.stringify(dirtyResult),
  );

  const duplicate = createUnitHistory(runRoot, 2);
  const duplicateResult = runIntegrate(
    duplicate.repo,
    'smoke-intent-integration-duplicate',
    duplicate.base,
    `${duplicate.commits[0]},${duplicate.commits[1]},${duplicate.commits[1]}`,
    validCommitMessage('Reject duplicate integration'),
  );
  assert(duplicateResult.exitCode !== 0, JSON.stringify(duplicateResult));
  assert(
    String(duplicateResult.message).includes('contains duplicates'),
    JSON.stringify(duplicateResult),
  );

  const nonContiguous = createUnitHistory(runRoot, 3);
  const nonContiguousResult = runIntegrate(
    nonContiguous.repo,
    'smoke-intent-integration-non-contiguous',
    nonContiguous.base,
    `${nonContiguous.commits[0]},${nonContiguous.commits[2]}`,
    validCommitMessage('Reject non-contiguous integration'),
  );
  assert(nonContiguousResult.exitCode !== 0, JSON.stringify(nonContiguousResult));
  assert(
    String(nonContiguousResult.message).includes('not contiguous'),
    JSON.stringify(nonContiguousResult),
  );

  const nonUnit = createUnitHistory(runRoot, 2, { nonUnitIndex: 0 });
  const nonUnitResult = runIntegrate(
    nonUnit.repo,
    'smoke-intent-integration-non-unit',
    nonUnit.base,
    nonUnit.commits.join(','),
    validCommitMessage('Reject non-Unit integration'),
  );
  assert(nonUnitResult.exitCode !== 0, JSON.stringify(nonUnitResult));
  assert(String(nonUnitResult.message).includes('non-Unit commit'), JSON.stringify(nonUnitResult));

  const hookFailure = createUnitHistory(runRoot, 2);
  const hookFailureHead = runGit(hookFailure.repo, ['rev-parse', 'HEAD']).stdout.trim();
  writeGitHook(hookFailure.repo, 'pre-commit', '#!/bin/sh\nexit 1\n');
  const hookFailureResult = runIntegrate(
    hookFailure.repo,
    'smoke-intent-integration-hook-failure',
    hookFailure.base,
    hookFailure.commits.join(','),
    validCommitMessage('Recover failed integration'),
  );
  assert(hookFailureResult.exitCode !== 0, JSON.stringify(hookFailureResult));
  assert(
    String(hookFailureResult.message).includes('original HEAD, index, and worktree were restored'),
    JSON.stringify(hookFailureResult),
  );
  assert(
    runGit(hookFailure.repo, ['rev-parse', 'HEAD']).stdout.trim() === hookFailureHead,
    JSON.stringify(hookFailureResult),
  );

  const treeMismatch = createUnitHistory(runRoot, 2);
  const treeMismatchHead = runGit(treeMismatch.repo, ['rev-parse', 'HEAD']).stdout.trim();
  writeGitHook(
    treeMismatch.repo,
    'pre-commit',
    '#!/bin/sh\nprintf "export const hook = true;\\n" > src/integration-hook.mjs\ngit add -- src/integration-hook.mjs\n',
  );
  const treeMismatchResult = runIntegrate(
    treeMismatch.repo,
    'smoke-intent-integration-tree-mismatch',
    treeMismatch.base,
    treeMismatch.commits.join(','),
    validCommitMessage('Recover tree mismatch'),
  );
  assert(treeMismatchResult.exitCode !== 0, JSON.stringify(treeMismatchResult));
  assert(
    String(treeMismatchResult.message).includes('changed the final tree'),
    JSON.stringify(treeMismatchResult),
  );
  assert(
    runGit(treeMismatch.repo, ['rev-parse', 'HEAD']).stdout.trim() === treeMismatchHead,
    JSON.stringify(treeMismatchResult),
  );
  assert(
    runGit(treeMismatch.repo, ['status', '--porcelain']).stdout.includes(
      'src/integration-hook.mjs',
    ),
    JSON.stringify(treeMismatchResult),
  );
}

// review後にstaged内容が変わったcandidateをhash不一致として拒否することを確認する。
function testHashMismatch(runRoot) {
  const id = 'smoke-hash-mismatch';
  const repo = createRepo(runRoot, { changedContent: 'export const value = 2;\n' });
  const review = runReview(repo, id);
  writeFileSync(join(repo, 'src/change.mjs'), 'export const value = 3;\n');
  runGit(repo, ['add', '--', 'src/change.mjs']);

  const result = runCommit(repo, id, validCommitMessage('Reject changed candidate'));
  assert(result.exitCode !== 0, JSON.stringify(result));
  assert(result.status === 'rejected', JSON.stringify(result));
  assert(
    String(result.message).includes('staged commit candidate changed'),
    JSON.stringify(result),
  );
  assert(!artifactExists(repo, id, 'hash'), review);
  assert(!artifactExists(repo, id, 'result'), review);
  assert(!artifactExists(repo, id, 'request'), review);
}

// hook失敗時はstaged hashが同じ場合だけartifactを保持し、index変更時は再レビューを要求する。
function testHookFailureRetry(runRoot) {
  const unchangedId = 'smoke-hook-failure-unchanged';
  const unchangedRepo = createRepo(runRoot, {
    changedContent: 'export const value = 2;\n',
  });
  const unchangedReview = runReview(unchangedRepo, unchangedId);
  writeGitHook(unchangedRepo, 'pre-commit', '#!/bin/sh\nexit 1\n');

  const unchangedFailure = runCommit(
    unchangedRepo,
    unchangedId,
    validCommitMessage('Retry unchanged hook failure'),
  );
  assert(unchangedFailure.exitCode !== 0, JSON.stringify(unchangedFailure));
  assert(unchangedFailure.retryable === true, JSON.stringify(unchangedFailure));
  assert(
    unchangedFailure.retryReason === 'commit_failed_unchanged_candidate',
    JSON.stringify(unchangedFailure),
  );
  assert(artifactExists(unchangedRepo, unchangedId, 'hash'), unchangedReview);
  assert(artifactExists(unchangedRepo, unchangedId, 'result'), unchangedReview);
  assert(artifactExists(unchangedRepo, unchangedId, 'request'), unchangedReview);

  rmSync(join(unchangedRepo, '.git/hooks/pre-commit'));
  const unchangedRetry = runCommit(
    unchangedRepo,
    unchangedId,
    validCommitMessage('Retry unchanged hook failure'),
  );
  assert(unchangedRetry.exitCode === 0, JSON.stringify(unchangedRetry));
  assert(unchangedRetry.status === 'committed', JSON.stringify(unchangedRetry));

  const changedId = 'smoke-hook-failure-changed';
  const changedRepo = createRepo(runRoot, {
    changedContent: 'export const value = 2;\n',
  });
  const changedReview = runReview(changedRepo, changedId);
  writeGitHook(
    changedRepo,
    'pre-commit',
    '#!/bin/sh\nprintf "export const value = 3;\\n" > src/change.mjs\ngit add -- src/change.mjs\nexit 1\n',
  );

  const changedFailure = runCommit(
    changedRepo,
    changedId,
    validCommitMessage('Reject changed hook candidate'),
  );
  assert(changedFailure.exitCode !== 0, JSON.stringify(changedFailure));
  assert(changedFailure.retryable === false, JSON.stringify(changedFailure));
  assert(changedFailure.retryReason === 'candidate_changed', JSON.stringify(changedFailure));
  assert(!artifactExists(changedRepo, changedId, 'hash'), changedReview);
  assert(!artifactExists(changedRepo, changedId, 'result'), changedReview);
  assert(!artifactExists(changedRepo, changedId, 'request'), changedReview);
}

// Why/What/Verify形式のIntent messageで検証済みcandidateをcommitできることを確認する。
function testCommit(runRoot) {
  const id = 'smoke-commit';
  const repo = createRepo(runRoot, {
    stagedFiles: ['README.md'],
    changedContent: '# committed smoke README\n',
  });
  const review = runReview(repo, id);
  const result = runCommit(repo, id, validCommitMessage('Commit verified candidate'));
  const log = runGit(repo, ['log', '-1', '--format=%B']).stdout;

  assert(review.status === 'no_review_required', review);
  assert(result.exitCode === 0, JSON.stringify(result));
  assert(result.status === 'committed' && result.cleanup?.ok === true, JSON.stringify(result));
  assert(log.includes('Why:\n') && log.includes('Verify:\n'), log);
  assert(log.includes('Co-authored-by: Cursor <cursoragent@cursor.com>'), log);
  assert(!artifactExists(repo, id, 'hash'), review);
  assert(!artifactExists(repo, id, 'result'), review);
  assert(!artifactExists(repo, id, 'request'), review);
}

// commit自体は成功してもartifact掃除に失敗した場合の警告を確認する。
function testCleanupFailure(runRoot) {
  const id = 'smoke-cleanup-failure';
  const repo = createRepo(runRoot, {
    changedContent: 'export const value = 2;\n',
  });
  const review = runReview(repo, id);
  const artifactDirectory = join(repo, '.cursor/skills/commit/scripts/.tmp');
  chmodSync(artifactDirectory, 0o555);

  try {
    const result = runCommit(repo, id, validCommitMessage('Report cleanup failure'));
    assert(review.status === 'review_required', review);
    assert(result.exitCode === 0, JSON.stringify(result));
    assert(result.status === 'committed', JSON.stringify(result));
    assert(result.cleanup?.ok === false, JSON.stringify(result));
    assert(result.warning?.includes('could not be removed'), JSON.stringify(result));
    assert(artifactExists(repo, id, 'hash'), JSON.stringify(result));
    assert(artifactExists(repo, id, 'result'), JSON.stringify(result));
    assert(artifactExists(repo, id, 'request'), JSON.stringify(result));
  } finally {
    chmodSync(artifactDirectory, 0o755);
  }
}

// 各テストが互いのGit状態やartifactを共有しないよう、独立したfixture repoを作る。
function createRepo(
  runRoot,
  { stagedFiles = ['src/change.mjs'], changedContent = null, packageScripts = null } = {},
) {
  const repo = mkdtempSync(join(runRoot, 'repo-'));
  mkdirSync(join(repo, 'src'), { recursive: true });
  writeFileSync(join(repo, 'src/change.mjs'), 'export const value = 1;\n');
  writeFileSync(join(repo, 'src/context.mjs'), 'export const context = true;\n');
  writeFileSync(join(repo, 'README.md'), '# smoke\n');
  if (packageScripts) {
    writeFileSync(join(repo, 'package.json'), `${JSON.stringify({ scripts: packageScripts })}\n`);
  }
  runGit(repo, ['init', '-q']);
  runGit(repo, ['config', 'user.name', 'Commit Skill Smoke']);
  runGit(repo, ['config', 'user.email', 'commit-skill-smoke@example.invalid']);
  runGit(repo, ['add', '.']);
  runGit(repo, ['commit', '-qm', 'init']);

  if (changedContent !== null && stagedFiles.includes('src/change.mjs')) {
    writeFileSync(join(repo, 'src/change.mjs'), changedContent);
  }
  if (changedContent !== null && stagedFiles.includes('README.md')) {
    writeFileSync(join(repo, 'README.md'), changedContent);
  }
  for (const path of stagedFiles) runGit(repo, ['add', '--', path]);
  return repo;
}

// review前checkを再現するfixtureへ、3つの品質checkを通す最小scriptを与える。
function passingCheckScripts() {
  return {
    'format:check': 'true',
    lint: 'true',
    'typecheck:staged': 'true',
  };
}

// integrate.mjsの検証対象になるlinearなUnit履歴を、指定件数だけ作る。
function createUnitHistory(runRoot, count, { nonUnitIndex = null } = {}) {
  const repo = createRepo(runRoot, { stagedFiles: [] });
  const base = runGit(repo, ['rev-parse', 'HEAD']).stdout.trim();
  const commits = [];

  for (let index = 0; index < count; index += 1) {
    const path = `src/unit-history-${index + 1}.mjs`;
    writeFileSync(join(repo, path), `export const unit${index + 1} = true;\n`);
    runGit(repo, ['add', '--', path]);
    const subject =
      index === nonUnitIndex
        ? `ordinary smoke commit ${index + 1}`
        : `unit-history-unit-${index + 1}: update history fixture`;
    runGit(repo, ['commit', '-qm', subject]);
    commits.push(runGit(repo, ['rev-parse', 'HEAD']).stdout.trim());
  }

  return { repo, base, commits };
}

// commit hookによる失敗やtree改変を再現するため、fixture repoへhookを配置する。
function writeGitHook(repo, name, body) {
  const path = join(repo, '.git', 'hooks', name);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, body);
  chmodSync(path, 0o755);
}

// review scriptを実プロセスで呼び、stdoutのJSONと終了コードを返す。
function runReview(repo, id, extraArgs = []) {
  const result = spawnSync(process.execPath, [REVIEW_SCRIPT, '--root', repo, ...extraArgs], {
    cwd: repo,
    encoding: 'utf8',
    env: cleanEnv(id),
  });
  return { ...parseJson(result.stdout), exitCode: result.status };
}

// measure scriptへ計画本文を渡し、indexを共有しない子プロセスとして実行する。
function runMeasure(repo, id, extraArgs = [], input = null) {
  const result = spawnSync(process.execPath, [MEASURE_SCRIPT, '--root', repo, ...extraArgs], {
    cwd: repo,
    encoding: 'utf8',
    env: cleanEnv(id),
    input,
  });
  return { ...parseJson(result.stdout), exitCode: result.status };
}

// commit scriptへmessageを標準入力で渡し、Harnessに近い境界を検証する。
function runCommit(repo, id, message) {
  const result = spawnSync(process.execPath, [COMMIT_SCRIPT, '--root', repo, '--message-stdin'], {
    cwd: repo,
    encoding: 'utf8',
    input: `${message}\n`,
    env: cleanEnv(id),
  });
  return { ...parseJson(result.stdout), exitCode: result.status };
}

// 旧来の単一Intentテストを、batch manifest一組の呼び出しへ変換する。
function runIntegrate(repo, id, base, commits, message) {
  return runBatchIntegrate(repo, id, base, [
    {
      intent: 'Smoke integration',
      mode: 'unit',
      commits: commits.split(',').map((commit) => commit.trim()),
      message,
    },
  ]);
}

// 複数Intentのmanifestを標準入力で渡し、履歴統合結果を返す。
function runBatchIntegrate(repo, id, base, groups) {
  return runRawIntegrate(repo, id, base, `${JSON.stringify({ groups })}\n`);
}

// manifest本文をそのまま渡し、JSON解析や入力検証の失敗を観測できるようにする。
function runRawIntegrate(repo, id, base, input) {
  const result = spawnSync(
    process.execPath,
    [INTEGRATE_SCRIPT, '--root', repo, '--base', base, '--manifest-stdin'],
    {
      cwd: repo,
      encoding: 'utf8',
      input,
      env: cleanEnv(id),
    },
  );
  return { ...parseJson(result.stdout), exitCode: result.status };
}

// 子プロセスへconversation IDを渡しつつ、親の一時Git indexは持ち込まない。
function cleanEnv(id) {
  const env = { ...process.env, CURSOR_CONVERSATION_ID: id };
  delete env.GIT_INDEX_FILE;
  return env;
}

// Skill固有artifactを読み、テスト側で余計な改行を無視する。
function readArtifact(repo, id, kind) {
  return readFileSync(artifactPath(repo, id, kind), 'utf8').trim();
}

// artifactが存在しないこと自体を異常にせず、存在判定だけを返す。
function artifactExists(repo, id, kind) {
  try {
    readArtifact(repo, id, kind);
    return true;
  } catch {
    return false;
  }
}

// fixture repo内のconversation-scoped artifact pathを組み立てる。
function artifactPath(repo, id, kind) {
  return join(repo, '.cursor/skills/commit/scripts/.tmp', `${id}.${kind}`);
}

// 統合テストで使う最小のWhy/What/Verify messageを一貫して作る。
function validCommitMessage(subject) {
  return [
    subject,
    '',
    'Why:',
    'commit Skillの境界を検証するため。',
    '',
    'What:',
    'staged candidateの処理を実行する。',
    '',
    'Verify:',
    '- colocated smoke testを実行した。',
  ].join('\n');
}

// 子プロセスが契約外の出力を返した場合、stdout付きで原因を示す。
function parseJson(output) {
  try {
    return JSON.parse(String(output || '{}'));
  } catch (error) {
    throw new Error(`Expected JSON output: ${errorMessage(error)}\n${output}`, { cause: error });
  }
}

// fixture repoのGit操作を実行し、失敗をテスト失敗として即座に伝える。
function runGit(repo, args) {
  const result = spawnSync('git', args, {
    cwd: repo,
    encoding: 'utf8',
    env: { ...process.env, GIT_INDEX_FILE: undefined },
  });
  if (result.status !== 0) {
    throw new Error(`git ${args.join(' ')} failed: ${result.stderr}`);
  }
  return result;
}

// Smokeの失敗箇所を一行で特定できるよう、条件と詳細をまとめて検証する。
function assert(condition, detail) {
  if (!condition) throw new Error(`assertion failed: ${detail}`);
}

// 子プロセスやassertのErrorを安定したテキストへ変換する。
function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

main();

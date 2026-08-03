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

function main() {
  mkdirSync(TMP_ROOT, { recursive: true });
  const runRoot = mkdtempSync(join(TMP_ROOT, 'smoke-'));
  const tests = [
    ['review creates a complete payload artifact', testReviewRequired],
    ['review includes explicit context files', testReviewContext],
    ['review notes are included in the artifact', testReviewNotes],
    ['large existing and new files are not truncated', testReviewFullDiff],
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
    ['unit commit message is accepted', testUnitCommit],
    ['intent integration preserves the final tree', testIntentIntegration],
    ['intent integration rejects unsafe history operations', testIntentIntegrationFailures],
    ['hash mismatch rejects commit', testHashMismatch],
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

function testReviewRequired(runRoot) {
  const id = 'smoke-review-required';
  const repo = createRepo(runRoot, { changedContent: 'export const value = 2;\n' });
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
}

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

function testReviewNotes(runRoot) {
  const id = 'smoke-review-note';
  const repo = createRepo(runRoot, { changedContent: 'export const value = 2;\n' });
  const result = runReview(repo, id, ['--note', 'Harness verifies PASS before commit.']);
  const payload = readArtifact(repo, id, 'request');

  assert(result.exitCode === 0, JSON.stringify(result));
  assert(payload.includes('Review notes:\nHarness verifies PASS before commit.'), payload);
}

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
      'long-subject',
      [
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
    assert(result.cleanup?.ok === true, JSON.stringify(result));
  }
}

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
    String(hookFailureResult.message).includes('original HEAD and index were restored'),
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
      'A  src/integration-hook.mjs',
    ),
    JSON.stringify(treeMismatchResult),
  );
}

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

function createRepo(runRoot, { stagedFiles = ['src/change.mjs'], changedContent = null } = {}) {
  const repo = mkdtempSync(join(runRoot, 'repo-'));
  mkdirSync(join(repo, 'src'), { recursive: true });
  writeFileSync(join(repo, 'src/change.mjs'), 'export const value = 1;\n');
  writeFileSync(join(repo, 'src/context.mjs'), 'export const context = true;\n');
  writeFileSync(join(repo, 'README.md'), '# smoke\n');
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

function writeGitHook(repo, name, body) {
  const path = join(repo, '.git', 'hooks', name);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, body);
  chmodSync(path, 0o755);
}

function runReview(repo, id, extraArgs = []) {
  const result = spawnSync(process.execPath, [REVIEW_SCRIPT, '--root', repo, ...extraArgs], {
    cwd: repo,
    encoding: 'utf8',
    env: cleanEnv(id),
  });
  return { ...parseJson(result.stdout), exitCode: result.status };
}

function runMeasure(repo, id, extraArgs = [], input = null) {
  const result = spawnSync(process.execPath, [MEASURE_SCRIPT, '--root', repo, ...extraArgs], {
    cwd: repo,
    encoding: 'utf8',
    env: cleanEnv(id),
    input,
  });
  return { ...parseJson(result.stdout), exitCode: result.status };
}

function runCommit(repo, id, message) {
  const result = spawnSync(process.execPath, [COMMIT_SCRIPT, '--root', repo, '--message-stdin'], {
    cwd: repo,
    encoding: 'utf8',
    input: `${message}\n`,
    env: cleanEnv(id),
  });
  return { ...parseJson(result.stdout), exitCode: result.status };
}

function runIntegrate(repo, id, base, commits, message) {
  const result = spawnSync(
    process.execPath,
    [INTEGRATE_SCRIPT, '--root', repo, '--base', base, '--commits', commits, '--message-stdin'],
    {
      cwd: repo,
      encoding: 'utf8',
      input: `${message}\n`,
      env: cleanEnv(id),
    },
  );
  return { ...parseJson(result.stdout), exitCode: result.status };
}

function cleanEnv(id) {
  const env = { ...process.env, CURSOR_CONVERSATION_ID: id };
  delete env.GIT_INDEX_FILE;
  return env;
}

function readArtifact(repo, id, kind) {
  return readFileSync(artifactPath(repo, id, kind), 'utf8').trim();
}

function artifactExists(repo, id, kind) {
  try {
    readArtifact(repo, id, kind);
    return true;
  } catch {
    return false;
  }
}

function artifactPath(repo, id, kind) {
  return join(repo, '.cursor/skills/commit/scripts/.tmp', `${id}.${kind}`);
}

function validCommitMessage(subject) {
  return [
    subject,
    '',
    'Why:',
    'The smoke test verifies the commit Skill boundary.',
    '',
    'What:',
    'Exercise the staged candidate flow.',
    '',
    'Verify:',
    '- colocated smoke test',
  ].join('\n');
}

function parseJson(output) {
  try {
    return JSON.parse(String(output || '{}'));
  } catch (error) {
    throw new Error(`Expected JSON output: ${errorMessage(error)}\n${output}`, { cause: error });
  }
}

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

function assert(condition, detail) {
  if (!condition) throw new Error(`assertion failed: ${detail}`);
}

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

main();

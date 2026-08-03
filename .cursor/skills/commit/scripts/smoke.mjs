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
const TMP_ROOT = join(SCRIPT_DIR, '.tmp');

function main() {
  mkdirSync(TMP_ROOT, { recursive: true });
  const runRoot = mkdtempSync(join(TMP_ROOT, 'smoke-'));
  const tests = [
    ['review required payload', testReviewRequired],
    ['accepted exclusions note', testAcceptedExclusions],
    ['new file has no per-file truncation', testNewFileLimit],
    ['existing diff fails closed when truncated', testExistingDiffLimit],
    ['total payload fails closed', testTotalLimit],
    ['stale artifacts are removed across conversation IDs', testStaleArtifacts],
    ['non-reviewable candidate skips reviewer', testNoReviewRequired],
    ['missing hash rejects commit', testMissingHash],
    ['invalid hash rejects commit', testInvalidHash],
    ['invalid commit message rejects commit', testInvalidCommitMessage],
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
  assert(result.request?.subagent_type === 'pre-commit-reviewer', JSON.stringify(result));
  assert(result.request.prompt.includes('[commit-review-artifact]'), result.request?.prompt);
  assert(result.request.prompt.includes(result.requestArtifact), result.request?.prompt);
  const payload = readArtifact(repo, id, 'request');
  assert(payload.includes('[commit-review-payload]'), payload);
  assert(payload.includes('src/change.mjs'), payload);
  assert(readArtifact(repo, id, 'hash').startsWith('sha256:'), result);
  assert(readArtifact(repo, id, 'result') === 'review_required', result);
}

function testAcceptedExclusions(runRoot) {
  const id = 'smoke-review-note';
  const repo = createRepo(runRoot, { changedContent: 'export const value = 2;\n' });
  const result = runReview(repo, id, ['--note', 'Harness verifies PASS before commit.']);
  assert(result.exitCode === 0, JSON.stringify(result));
  assert(
    readArtifact(repo, id, 'request').includes(
      'Accepted exclusions:\nHarness verifies PASS before commit.',
    ),
    readArtifact(repo, id, 'request'),
  );
}

function testNewFileLimit(runRoot) {
  const id = 'smoke-new-file-limit';
  const repo = createRepo(runRoot, { stagedFiles: [] });
  const content = 'export const value = 2;\n' + '// new file content\n'.repeat(700);
  writeFileSync(join(repo, 'src/new-file.mjs'), content);
  runGit(repo, ['add', '--', 'src/new-file.mjs']);

  const result = runReview(repo, id);
  assert(result.exitCode === 0, JSON.stringify(result));
  assert(result.status === 'review_required', JSON.stringify(result));
  const payload = readArtifact(repo, id, 'request');
  assert(payload.length > 10_000, payload.length);
  assert(!payload.includes('[This file section was truncated.]'), payload);
  assert(payload.includes('+// new file content'), 'new file content was not included');
}

function testExistingDiffLimit(runRoot) {
  const id = 'smoke-existing-diff-limit';
  const repo = createRepo(runRoot, { changedContent: 'export const value = 2;\n' });
  const initial = runReview(repo, id);
  assert(initial.exitCode === 0, JSON.stringify(initial));

  writeFileSync(join(repo, 'src/change.mjs'), '// changed file\n'.repeat(800));
  runGit(repo, ['add', '--', 'src/change.mjs']);
  const result = runReview(repo, id);
  assert(result.exitCode !== 0, JSON.stringify(result));
  assert(result.status === 'error' && result.truncated === true, JSON.stringify(result));
  assert(String(result.message).includes('Split the staged candidate'), JSON.stringify(result));
  assert(!artifactExists(repo, id, 'hash'), JSON.stringify(result));
  assert(!artifactExists(repo, id, 'result'), JSON.stringify(result));
  assert(!artifactExists(repo, id, 'request'), JSON.stringify(result));
}

function testTotalLimit(runRoot) {
  const id = 'smoke-total-limit';
  const repo = createRepo(runRoot, { stagedFiles: [] });
  for (let index = 0; index < 6; index += 1) {
    const path = `src/new-${index}.mjs`;
    writeFileSync(
      join(repo, path),
      `export const file${index} = true;\n` + '// content\n'.repeat(1_200),
    );
    runGit(repo, ['add', '--', path]);
  }

  const result = runReview(repo, id);
  assert(result.exitCode !== 0, JSON.stringify(result));
  assert(result.status === 'error' && result.truncated === true, JSON.stringify(result));
  assert(!artifactExists(repo, id, 'hash'), JSON.stringify(result));
  assert(!artifactExists(repo, id, 'result'), JSON.stringify(result));
  assert(!artifactExists(repo, id, 'request'), JSON.stringify(result));
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
  assert(currentReview.status === 'review_required', JSON.stringify(currentReview));
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

function runReview(repo, id, extraArgs = []) {
  const result = spawnSync(process.execPath, [REVIEW_SCRIPT, '--root', repo, ...extraArgs], {
    cwd: repo,
    encoding: 'utf8',
    env: cleanEnv(id),
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

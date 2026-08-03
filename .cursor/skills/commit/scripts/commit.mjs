#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import {
  readHashArtifact,
  removeHashArtifact,
  removeReviewRequestArtifact,
  removeReviewResultArtifact,
} from './lib/artifact.mjs';
import { collectStagedSnapshot, runGit } from './lib/snapshot.mjs';
import { workspaceRoot } from './lib/workspace.mjs';

function main() {
  const args = parseArgs(process.argv.slice(2));
  const root = workspaceRoot(args.root);
  let outcome;

  try {
    if (!args.messageStdin)
      throw new Error('Use --message-stdin for the formatted commit message.');

    const stored = readHashArtifact(root);
    if (!stored.ok) {
      throw new Error(
        stored.missing ? 'Review hash is missing. Run the review script first.' : stored.message,
      );
    }

    const message = normalizeCommitMessage(readStdin());

    const snapshot = collectStagedSnapshot(root, { includeEntries: false });
    if (!snapshot.ok) throw new Error(snapshot.message);
    if (snapshot.hash !== stored.hash) {
      throw new Error('The staged commit candidate changed. Run the review script again.');
    }

    const commit = runGit(root, ['commit', '-F', '-'], { input: `${message}\n` });
    if (!commit.ok) throw new Error(commit.message);

    outcome = { ok: true, status: 'committed', subject: message.split('\n', 1)[0] };
  } catch (error) {
    outcome = { ok: false, status: 'rejected', message: errorMessage(error) };
  }

  const cleanup = cleanupArtifacts(root);
  // commit成功後のcleanup失敗は結果を失敗扱いにせず、cleanup状態として明示する。
  if (!cleanup.ok) {
    outcome = {
      ...outcome,
      cleanup,
      warning: 'Commit completed, but review artifacts could not be removed.',
    };
  } else outcome = { ...outcome, cleanup: { ok: true } };

  emit(outcome);
  if (outcome.ok !== true) process.exitCode = 1;
}

function cleanupArtifacts(root) {
  const errors = [];
  const hash = removeHashArtifact(root);
  if (!hash.ok) errors.push(hash.message);
  const result = removeReviewResultArtifact(root);
  if (!result.ok) errors.push(result.message);
  const request = removeReviewRequestArtifact(root);
  if (!request.ok) errors.push(request.message);
  return errors.length === 0 ? { ok: true } : { ok: false, errors };
}

function parseArgs(argv) {
  const args = { root: null, messageStdin: false };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === '--root') {
      args.root = argv[index + 1];
      index += 1;
      continue;
    }
    if (value === '--message-stdin') {
      args.messageStdin = true;
      continue;
    }
    throw new Error(`Unknown argument: ${value}`);
  }
  return args;
}

function readStdin() {
  // heredocの改行を保持したままcommit messageを受け取る。
  return readFileSync(0, 'utf8');
}

function normalizeCommitMessage(raw) {
  const body = String(raw ?? '')
    .replace(/\r\n?/g, '\n')
    .replace(/^\s*Co-authored-by:\s*Cursor\s*<?cursoragent@cursor\.com>?\s*$/gim, '')
    .trim();
  const match = body.match(
    /^([^\n]+)\n\nWhy:\n([\s\S]*?)\n\nWhat:\n([\s\S]*?)\n\nVerify:\n([\s\S]*)$/,
  );
  if (!match) {
    throw new Error('Commit message must contain Subject, Why, What, and Verify sections.');
  }

  const [, subject, why, what, verify] = match;
  if (subject.length > 72) throw new Error('Commit subject must be 72 characters or fewer.');
  if (subject.endsWith('.')) throw new Error('Commit subject must not end with a period.');
  if (!why.trim()) throw new Error('Commit message Why section is empty.');
  if (!what.trim()) throw new Error('Commit message What section is empty.');
  if (!verify.trim()) throw new Error('Commit message Verify section is empty.');
  if (!verify.split('\n').some((line) => line.startsWith('- ') || line.startsWith('N/A:'))) {
    throw new Error('Commit message Verify section needs a check bullet or N/A reason.');
  }

  return `${body}\n\nCo-authored-by: Cursor <cursoragent@cursor.com>`;
}

function emit(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

try {
  main();
} catch (error) {
  emit({ ok: false, status: 'error', message: errorMessage(error) });
  process.exitCode = 1;
}

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

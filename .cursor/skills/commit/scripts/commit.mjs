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
import { parseCommitMessage } from '../../lib/commit-message.mjs';

export { normalizeCommitMessage } from '../../lib/commit-message.mjs';

function main() {
  const args = parseArgs(process.argv.slice(2));
  const root = workspaceRoot(args.root);
  if (!args.messageStdin) {
    emit({
      ok: false,
      status: 'error',
      message: 'Use --message-stdin for the formatted commit message.',
    });
    process.exitCode = 1;
    return;
  }

  let parsedMessage;
  try {
    parsedMessage = parseCommitMessage(readStdin());
  } catch (error) {
    // messageだけの修正で再レビューを要求しないため、既存artifactを保持する。
    emit({
      ok: false,
      status: 'rejected',
      message: errorMessage(error),
      retryable: true,
      retryReason: 'message_validation',
      artifacts: { preserved: true },
    });
    process.exitCode = 1;
    return;
  }

  let outcome;
  let storedHash = null;

  try {
    const stored = readHashArtifact(root);
    if (!stored.ok) {
      throw new Error(
        stored.missing ? 'Review hash is missing. Run the review script first.' : stored.message,
      );
    }
    storedHash = stored.hash;

    const snapshot = collectStagedSnapshot(root, { includeEntries: false });
    if (!snapshot.ok) throw new Error(snapshot.message);
    if (snapshot.hash !== stored.hash) {
      throw new Error('The staged commit candidate changed. Run the review script again.');
    }

    const commit = runGit(root, ['commit', '-F', '-'], { input: `${parsedMessage.message}\n` });
    if (!commit.ok) throw new Error(commit.message);

    outcome = {
      ok: true,
      status: 'committed',
      subject: parsedMessage.message.split('\n', 1)[0],
      warnings: parsedMessage.warnings,
    };
  } catch (error) {
    outcome = { ok: false, status: 'rejected', message: errorMessage(error) };
  }

  if (storedHash) {
    // commit hookの失敗後にindexが同じなら、review済みcandidateとしてretryを許可する。
    const current = collectStagedSnapshot(root, { includeEntries: false });
    if (current.ok && current.hash === storedHash && outcome.ok !== true) {
      emit({
        ...outcome,
        retryable: true,
        retryReason: 'commit_failed_unchanged_candidate',
        artifacts: { preserved: true },
      });
      process.exitCode = 1;
      return;
    }
    if (current.ok && current.hash !== storedHash && outcome.ok !== true) {
      outcome = {
        ...outcome,
        retryable: false,
        retryReason: 'candidate_changed',
      };
    }
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

#!/usr/bin/env node
import { buildReviewPayload, collectStagedSnapshot } from './lib/snapshot.mjs';
import {
  removeHashArtifact,
  removeReviewResultArtifact,
  writeHashArtifact,
  writeReviewResultArtifact,
} from './lib/artifact.mjs';
import { workspaceRoot } from './lib/workspace.mjs';

function main() {
  const args = parseArgs(process.argv.slice(2));
  const root = workspaceRoot(args.root);
  const staleCleanup = clearReviewArtifacts(root);
  if (!staleCleanup.ok) {
    emit({ ok: false, status: 'error', message: staleCleanup.message });
    process.exitCode = 1;
    return;
  }
  const snapshot = collectStagedSnapshot(root, { includeEntries: true });

  if (!snapshot.ok) {
    emit({ ok: false, status: 'error', message: snapshot.message });
    process.exitCode = 1;
    return;
  }

  const artifact = writeHashArtifact(root, snapshot.hash);
  if (!artifact.ok) {
    emit({ ok: false, status: 'error', message: artifact.message });
    process.exitCode = 1;
    return;
  }

  const review = buildReviewPayload(root, snapshot, args.note);
  if (review.truncated) {
    removeHashArtifact(root);
    emit({
      ok: false,
      status: 'error',
      message:
        'The staged review payload exceeds its character limit. Split the staged candidate into smaller commits or staged hunks, then run the review script again.',
      stagedPaths: snapshot.paths,
      reviewablePaths: snapshot.reviewablePaths,
      truncated: true,
    });
    process.exitCode = 1;
    return;
  }
  const status = review.payload ? 'review_required' : 'no_review_required';
  const resultArtifact = writeReviewResultArtifact(root, status);
  if (!resultArtifact.ok) {
    emit({ ok: false, status: 'error', message: resultArtifact.message });
    process.exitCode = 1;
    return;
  }

  if (!review.payload) {
    emit({
      ok: true,
      status,
      message: 'No staged files match the current reviewable extensions. No reviewer is required.',
      artifact: artifact.path,
      resultArtifact: resultArtifact.path,
      stagedPaths: snapshot.paths,
    });
    return;
  }

  emit({
    ok: true,
    status,
    artifact: artifact.path,
    resultArtifact: resultArtifact.path,
    request: {
      description: 'Pre-commit review',
      prompt: review.payload,
      subagent_type: 'pre-commit-reviewer',
    },
    reviewablePaths: snapshot.reviewablePaths,
    truncated: review.truncated,
  });
}

function parseArgs(argv) {
  const args = { root: null, note: null };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === '--root') {
      args.root = argv[index + 1];
      index += 1;
      continue;
    }
    if (value === '--note') {
      const note = argv[index + 1];
      if (!note?.trim()) throw new Error('The --note argument must not be empty.');
      args.note = note;
      index += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${value}`);
  }
  return args;
}

function clearReviewArtifacts(root) {
  const hash = removeHashArtifact(root);
  if (!hash.ok) return hash;
  const result = removeReviewResultArtifact(root);
  if (!result.ok) return result;
  return { ok: true };
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

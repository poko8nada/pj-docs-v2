#!/usr/bin/env node
import {
  buildReviewPayload,
  collectStagedSnapshot,
  validateContextPaths,
} from './lib/snapshot.mjs';
import {
  removeHashArtifact,
  removeReviewRequestArtifact,
  removeReviewResultArtifact,
  removeStaleReviewArtifacts,
  writeHashArtifact,
  writeReviewRequestArtifact,
  writeReviewResultArtifact,
} from './lib/artifact.mjs';
import { runLocalChecks } from './lib/checks.mjs';
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

  const contextValidation = validateContextPaths(root, args.context, snapshot.paths);
  if (!contextValidation.ok) {
    emit({ ok: false, status: 'error', message: contextValidation.message });
    process.exitCode = 1;
    return;
  }
  const contextPaths = contextValidation.paths;
  if (contextPaths.length > 0 && snapshot.reviewablePaths.length === 0) {
    emit({
      ok: false,
      status: 'error',
      message: 'Context files require at least one staged reviewable path.',
    });
    process.exitCode = 1;
    return;
  }

  const localChecks = runLocalChecks(root, snapshot.paths);
  if (!localChecks.ok) {
    // reviewerを起動する前に、commit hookと同じ品質ゲートをcandidateへ適用する。
    emit({
      ok: false,
      status: 'checks_failed',
      message:
        'Local format, lint, or typecheck reported errors or warnings. Fix them before review.',
      checks: localChecks.checks,
      stagedPaths: snapshot.paths,
      reviewablePaths: snapshot.reviewablePaths,
      contextPaths,
    });
    process.exitCode = 1;
    return;
  }

  const artifact = writeHashArtifact(root, snapshot.hash);
  if (!artifact.ok) {
    emit({ ok: false, status: 'error', message: artifact.message });
    process.exitCode = 1;
    return;
  }

  const review = buildReviewPayload(root, snapshot, args.note, { contextPaths });
  if (!review.complete) {
    const cleanup = removeHashArtifact(root);
    emit({
      ok: false,
      status: 'error',
      message: cleanup.ok
        ? `Unable to build a complete review payload. Missing staged diff entries: ${review.missingPaths.join(', ')}.`
        : `Unable to build a complete review payload, and the review hash could not be removed: ${cleanup.message}`,
      stagedPaths: snapshot.paths,
      reviewablePaths: snapshot.reviewablePaths,
      contextPaths,
      missingPaths: review.missingPaths,
    });
    process.exitCode = 1;
    return;
  }
  const requestArtifact = review.payload
    ? writeReviewRequestArtifact(root, review.payload)
    : { ok: true, path: null };
  if (!requestArtifact.ok) {
    removeHashArtifact(root);
    emit({ ok: false, status: 'error', message: requestArtifact.message });
    process.exitCode = 1;
    return;
  }
  const status = review.payload ? 'review_required' : 'no_review_required';
  const resultArtifact = writeReviewResultArtifact(root, status);
  if (!resultArtifact.ok) {
    removeHashArtifact(root);
    removeReviewRequestArtifact(root);
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
      contextPaths,
      checks: localChecks.checks,
    });
    return;
  }

  emit({
    ok: true,
    status,
    artifact: artifact.path,
    resultArtifact: resultArtifact.path,
    requestArtifact: requestArtifact.path,
    request: buildReviewRequest(requestArtifact.path),
    reviewablePaths: snapshot.reviewablePaths,
    contextPaths,
    checks: localChecks.checks,
    complete: true,
  });
}

function parseArgs(argv) {
  const args = { root: null, note: null, context: [] };
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
    if (value === '--context') {
      const contextPath = argv[index + 1];
      if (!contextPath?.trim()) throw new Error('The --context argument must not be empty.');
      args.context.push(contextPath);
      index += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${value}`);
  }
  return args;
}

function clearReviewArtifacts(root) {
  const stale = removeStaleReviewArtifacts(root);
  if (!stale.ok) return stale;
  const hash = removeHashArtifact(root);
  if (!hash.ok) return hash;
  const result = removeReviewResultArtifact(root);
  if (!result.ok) return result;
  const request = removeReviewRequestArtifact(root);
  if (!request.ok) return request;
  return { ok: true };
}

function buildReviewRequest(requestPath) {
  return {
    description: 'Pre-commit review',
    prompt: [
      '[commit-review-artifact]',
      `Review Payload Artifact: ${requestPath}`,
      'Read the generated artifact as the complete review payload. If it lists Context Files, read only those exact files. Do not run Git or inspect unrelated files.',
    ].join('\n'),
    subagent_type: 'pre-commit-reviewer',
  };
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

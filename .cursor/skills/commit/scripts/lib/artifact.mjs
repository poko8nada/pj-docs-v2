import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { hashArtifactPath, reviewResultArtifactPath } from './workspace.mjs';

const HASH_RE = /^sha256:[0-9a-f]{64}$/i;
const REVIEW_RESULT_STATUSES = new Set(['review_required', 'no_review_required']);

export function writeHashArtifact(root, hash) {
  const path = hashArtifactPath(root);
  try {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, `${hash}\n`, 'utf8');
    return { ok: true, path };
  } catch (error) {
    return {
      ok: false,
      path,
      message: `Unable to write the commit review hash: ${errorMessage(error)}`,
    };
  }
}

export function readHashArtifact(root) {
  const path = hashArtifactPath(root);
  if (!existsSync(path)) return { ok: false, missing: true, path };

  try {
    const hash = readFileSync(path, 'utf8').trim();
    if (!HASH_RE.test(hash)) {
      return { ok: false, missing: false, path, message: 'The stored hash is invalid.' };
    }
    return { ok: true, path, hash };
  } catch (error) {
    return {
      ok: false,
      missing: false,
      path,
      message: `Unable to read the commit review hash: ${errorMessage(error)}`,
    };
  }
}

export function removeHashArtifact(root) {
  const path = hashArtifactPath(root);
  try {
    unlinkSync(path);
    return { ok: true, path, removed: true };
  } catch (error) {
    if (error?.code === 'ENOENT') return { ok: true, path, removed: false };
    return {
      ok: false,
      path,
      removed: false,
      message: `Unable to remove the commit review hash: ${errorMessage(error)}`,
    };
  }
}

export function writeReviewResultArtifact(root, status) {
  const path = reviewResultArtifactPath(root);
  if (!REVIEW_RESULT_STATUSES.has(status)) {
    return { ok: false, path, message: `Invalid review result status: ${status}` };
  }
  try {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, `${status}\n`, 'utf8');
    return { ok: true, path };
  } catch (error) {
    return {
      ok: false,
      path,
      message: `Unable to write the review result: ${errorMessage(error)}`,
    };
  }
}

export function removeReviewResultArtifact(root) {
  const path = reviewResultArtifactPath(root);
  try {
    unlinkSync(path);
    return { ok: true, path, removed: true };
  } catch (error) {
    if (error?.code === 'ENOENT') return { ok: true, path, removed: false };
    return {
      ok: false,
      path,
      removed: false,
      message: `Unable to remove the review result: ${errorMessage(error)}`,
    };
  }
}

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

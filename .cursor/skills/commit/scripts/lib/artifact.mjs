import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import {
  hashArtifactPath,
  reviewArtifactDirectoryPath,
  reviewRequestArtifactPath,
  reviewResultArtifactPath,
} from './workspace.mjs';

const HASH_RE = /^sha256:[0-9a-f]{64}$/i;
const REVIEW_RESULT_STATUSES = new Set(['review_required', 'no_review_required']);
const REVIEW_ARTIFACT_NAME_RE = /^[a-zA-Z0-9._-]+\.(hash|result|request)$/;
export const REVIEW_ARTIFACT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

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

export function writeReviewRequestArtifact(root, payload) {
  const path = reviewRequestArtifactPath(root);
  try {
    mkdirSync(dirname(path), { recursive: true });
    const text = String(payload ?? '');
    writeFileSync(path, text.endsWith('\n') ? text : `${text}\n`, 'utf8');
    return { ok: true, path };
  } catch (error) {
    return {
      ok: false,
      path,
      message: `Unable to write the review request: ${errorMessage(error)}`,
    };
  }
}

export function removeReviewRequestArtifact(root) {
  const path = reviewRequestArtifactPath(root);
  try {
    unlinkSync(path);
    return { ok: true, path, removed: true };
  } catch (error) {
    if (error?.code === 'ENOENT') return { ok: true, path, removed: false };
    return {
      ok: false,
      path,
      removed: false,
      message: `Unable to remove the review request: ${errorMessage(error)}`,
    };
  }
}

export function removeStaleReviewArtifacts(root, { now = Date.now() } = {}) {
  const directory = reviewArtifactDirectoryPath(root);
  let names;
  try {
    names = readdirSync(directory);
  } catch (error) {
    if (error?.code === 'ENOENT') return { ok: true, removed: [] };
    return {
      ok: false,
      removed: [],
      message: `Unable to scan review artifacts: ${errorMessage(error)}`,
    };
  }

  const removed = [];
  const errors = [];
  for (const name of names) {
    if (!REVIEW_ARTIFACT_NAME_RE.test(name)) continue;
    const path = join(directory, name);
    let stats;
    try {
      stats = statSync(path);
    } catch (error) {
      if (error?.code === 'ENOENT') continue;
      errors.push(`${path}: ${errorMessage(error)}`);
      continue;
    }
    if (!stats.isFile() || now - stats.mtimeMs <= REVIEW_ARTIFACT_MAX_AGE_MS) continue;
    try {
      unlinkSync(path);
      removed.push(path);
    } catch (error) {
      errors.push(`${path}: ${errorMessage(error)}`);
    }
  }

  if (errors.length > 0) {
    return {
      ok: false,
      removed,
      message: `Unable to remove stale review artifacts: ${errors.join('; ')}`,
    };
  }
  return { ok: true, removed };
}

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

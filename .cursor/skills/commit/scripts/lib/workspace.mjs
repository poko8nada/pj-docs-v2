import { basename, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PACKAGE_DIR = resolve(SCRIPT_DIR, '..');
const WORKSPACE_DIR = resolve(PACKAGE_DIR, '../../..');
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function workspaceRoot(explicitRoot = null) {
  return resolve(explicitRoot || process.env.COMMIT_SKILL_ROOT || WORKSPACE_DIR);
}

export function conversationId() {
  const direct = String(process.env.CURSOR_CONVERSATION_ID ?? '').trim();
  if (direct && direct !== 'unknown') return sanitizeId(direct);

  const transcript = String(process.env.CURSOR_TRANSCRIPT_PATH ?? '');
  for (const candidate of [basename(transcript, '.jsonl'), basename(dirname(transcript))]) {
    if (UUID_RE.test(candidate)) return sanitizeId(candidate);
  }

  return 'standalone';
}

export function sanitizeId(id) {
  return String(id).replace(/[^a-zA-Z0-9._-]+/g, '_') || 'standalone';
}

export function hashArtifactPath(root) {
  return resolve(root, '.cursor/skills/commit/scripts/.tmp', `${conversationId()}.hash`);
}

export function reviewResultArtifactPath(root) {
  return resolve(root, '.cursor/skills/commit/scripts/.tmp', `${conversationId()}.result`);
}

#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { normalizeCommitMessage, isUnitCommitSubject } from './lib/commit-message.mjs';
import { runGit } from './lib/snapshot.mjs';
import { workspaceRoot } from './lib/workspace.mjs';

function main() {
  const args = parseArgs(process.argv.slice(2));
  const root = workspaceRoot(args.root);
  if (!args.messageStdin) throw new Error('Use --message-stdin for the Intent message.');

  const message = normalizeCommitMessage(readFileSync(0, 'utf8'), { allowUnit: false });
  const base = resolveCommit(root, args.base);
  const requestedCommits = parseCommitRefs(args.commits);
  const head = resolveCommit(root, 'HEAD');
  ensureCleanWorktree(root);

  const commits = requestedCommits.map((ref) => resolveCommit(root, ref));
  validateCommitRange(root, base, head, commits);
  const beforeTree = resolveRef(root, 'HEAD^{tree}');

  // 明示されたUnit範囲だけを履歴上でまとめ、内容の同一性を検証する。
  const reset = runGit(root, ['reset', '--soft', base]);
  if (!reset.ok) throw new Error(reset.message);

  const commit = runGit(root, ['commit', '-F', '-'], { input: `${message}\n` });
  if (!commit.ok) {
    const recovery = runGit(root, ['reset', '--mixed', head]);
    const recoveryMessage = recovery.ok
      ? 'The original HEAD and index were restored.'
      : `The integration failed and recovery also failed: ${recovery.message}`;
    throw new Error(`${commit.message} ${recoveryMessage}`);
  }

  const integratedHead = resolveCommit(root, 'HEAD');
  const afterTree = resolveRef(root, 'HEAD^{tree}');
  if (beforeTree !== afterTree) {
    const recovery = runGit(root, ['reset', '--soft', head]);
    const recoveryMessage = recovery.ok
      ? 'The original Unit history was restored; inspect the staged tree before continuing.'
      : `The tree changed and recovery also failed: ${recovery.message}`;
    throw new Error(`Intent integration changed the final tree. ${recoveryMessage}`);
  }

  emit({
    ok: true,
    status: 'integrated',
    base,
    unitCommits: commits,
    commit: integratedHead,
    tree: beforeTree,
  });
}

function validateCommitRange(root, base, head, commits) {
  if (commits.length === 0) throw new Error('At least one Unit commit is required.');
  if (new Set(commits).size !== commits.length) {
    throw new Error('The integration commit list contains duplicates.');
  }
  if (commits.at(-1) !== head) {
    throw new Error('The last integration commit must be the current HEAD.');
  }
  if (resolveParent(root, commits[0]) !== base) {
    throw new Error('The first Unit commit must directly follow the supplied base.');
  }

  for (let index = 0; index < commits.length; index += 1) {
    const commit = commits[index];
    const parents = readParents(root, commit);
    if (parents.length !== 1) throw new Error(`Unit commit is not linear: ${commit}`);
    if (index > 0 && parents[0] !== commits[index - 1]) {
      throw new Error(`Integration commit range is not contiguous at ${commit}.`);
    }
    const subject = readSubject(root, commit);
    if (!isUnitCommitSubject(subject)) {
      throw new Error(`Integration range contains a non-Unit commit: ${subject}`);
    }
  }
}

function ensureCleanWorktree(root) {
  const status = runGit(root, ['status', '--porcelain']);
  if (!status.ok) throw new Error(status.message);
  if (bufferText(status.stdout).trim()) {
    throw new Error('Intent integration requires a clean worktree and index.');
  }
}

function resolveCommit(root, ref) {
  return resolveRef(root, `${ref}^{commit}`);
}

function resolveParent(root, commit) {
  const parents = readParents(root, commit);
  if (parents.length !== 1) throw new Error(`Unit commit is not linear: ${commit}`);
  return parents[0];
}

function readParents(root, commit) {
  const result = runGit(root, ['rev-list', '--parents', '-n', '1', commit]);
  if (!result.ok) throw new Error(result.message);
  const fields = bufferText(result.stdout).trim().split(/\s+/);
  return fields.slice(1);
}

function readSubject(root, commit) {
  const result = runGit(root, ['log', '-1', '--format=%s', commit]);
  if (!result.ok) throw new Error(result.message);
  return bufferText(result.stdout).trim();
}

function resolveRef(root, ref) {
  const result = runGit(root, ['rev-parse', '--verify', ref]);
  if (!result.ok) throw new Error(result.message);
  return bufferText(result.stdout).trim();
}

function parseCommitRefs(value) {
  const refs = String(value ?? '')
    .split(',')
    .map((ref) => ref.trim())
    .filter(Boolean);
  if (refs.length === 0) throw new Error('Use --commits <sha1,sha2,...> for Unit commits.');
  return refs;
}

function parseArgs(argv) {
  const args = { root: null, base: null, commits: null, messageStdin: false };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === '--root') {
      args.root = argv[index + 1];
      index += 1;
      continue;
    }
    if (value === '--base') {
      args.base = argv[index + 1];
      index += 1;
      continue;
    }
    if (value === '--commits') {
      args.commits = argv[index + 1];
      index += 1;
      continue;
    }
    if (value === '--message-stdin') {
      args.messageStdin = true;
      continue;
    }
    throw new Error(`Unknown argument: ${value}`);
  }
  if (!args.base) throw new Error('Use --base <commit> for the pre-Unit base.');
  if (!args.commits) throw new Error('Use --commits <sha1,sha2,...> for Unit commits.');
  return args;
}

function emit(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function bufferText(value) {
  return Buffer.isBuffer(value) ? value.toString('utf8') : String(value ?? '');
}

try {
  main();
} catch (error) {
  emit({ ok: false, status: 'rejected', message: errorMessage(error) });
  process.exitCode = 1;
}

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

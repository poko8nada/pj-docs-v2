#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { normalizeCommitMessage, isUnitCommitSubject } from '../../lib/commit-message.mjs';
import { runGit } from './lib/snapshot.mjs';
import { workspaceRoot } from './lib/workspace.mjs';

// manifestを検証し、source commit群をIntent単位の最終履歴へ再構成する。
function main() {
  const args = parseArgs(process.argv.slice(2));
  const root = workspaceRoot(args.root);
  if (!args.manifestStdin) throw new Error('Use --manifest-stdin for the Intent manifest.');

  const manifest = parseManifest(readFileSync(0, 'utf8'));
  const base = resolveCommit(root, args.base);
  const head = resolveCommit(root, 'HEAD');
  ensureCleanWorktree(root);
  const groups = resolveGroups(root, manifest.groups);
  const commits = groups.flatMap((group) => group.commits);
  validateCommitRange(root, base, head, groups, commits);
  const beforeTree = resolveRef(root, 'HEAD^{tree}');

  try {
    // 全source commitの範囲を一度だけ巻き戻し、Intentごとの最終commitを順に再構成する。
    const reset = runGit(root, ['reset', '--mixed', base]);
    if (!reset.ok) throw new Error(reset.message);

    const intentCommits = [];
    for (const group of groups) {
      // 各Intentの最後のsource treeを復元して、最終メッセージで一つにまとめる。
      const target = group.commits.at(-1);
      const restore = runGit(root, [
        'restore',
        '--source',
        target,
        '--staged',
        '--worktree',
        '--',
        '.',
      ]);
      if (!restore.ok) throw new Error(restore.message);
      const commit = runGit(root, ['commit', '-F', '-'], { input: `${group.message}\n` });
      if (!commit.ok) throw new Error(commit.message);
      intentCommits.push({
        intent: group.intent,
        sourceCommits: group.commits,
        commit: resolveCommit(root, 'HEAD'),
      });
    }

    const integratedHead = resolveCommit(root, 'HEAD');
    const afterTree = resolveRef(root, 'HEAD^{tree}');
    if (beforeTree !== afterTree) {
      throw new Error('Intent integration changed the final tree.');
    }

    emit({
      ok: true,
      status: 'integrated',
      base,
      intentCommits,
      commit: integratedHead,
      tree: beforeTree,
    });
  } catch (error) {
    const recoveryMessage = recoverOriginalTree(root, head);
    throw new Error(`${errorMessage(error)} ${recoveryMessage}`, { cause: error });
  }
}

// 指定されたsource commitが、baseからHEADまでの連続した安全な範囲か検証する。
function validateCommitRange(root, base, head, groups, commits) {
  if (commits.length === 0) throw new Error('At least one Intent group is required.');
  if (new Set(commits).size !== commits.length) {
    throw new Error('The integration commit list contains duplicates.');
  }
  if (commits.at(-1) !== head) {
    throw new Error('The last integration commit must be the current HEAD.');
  }
  if (resolveParent(root, commits[0]) !== base) {
    throw new Error('The first source commit must directly follow the supplied base.');
  }

  let commitIndex = 0;
  for (const group of groups) {
    if (group.commits.length === 0) throw new Error('Each Intent group needs at least one commit.');
    if (group.mode === 'intent' && group.commits.length !== 1) {
      throw new Error('An Intent commit group must contain exactly one source commit.');
    }
    for (const commit of group.commits) {
      const index = commitIndex;
      commitIndex += 1;
      const parents = readParents(root, commit);
      if (parents.length !== 1) throw new Error(`Commit is not linear: ${commit}`);
      if (index > 0 && parents[0] !== commits[index - 1]) {
        throw new Error(`Integration commit range is not contiguous at ${commit}.`);
      }
      const subject = readSubject(root, commit);
      if (group.mode === 'unit' && !isUnitCommitSubject(subject)) {
        throw new Error(`Integration range contains a non-Unit commit: ${subject}`);
      }
      if (group.mode === 'intent') {
        // 単一Intent行は既に最終形式でcommit済みであることも確認する。
        normalizeCommitMessage(readMessage(root, commit), { allowUnit: false });
      }
    }
  }
}

// 標準入力のJSONを解釈し、空のmanifestや壊れた形式を早期に拒否する。
function parseManifest(raw) {
  let manifest;
  try {
    manifest = JSON.parse(String(raw ?? ''));
  } catch (error) {
    throw new Error(`Integration manifest is not valid JSON: ${errorMessage(error)}`, {
      cause: error,
    });
  }
  if (!Array.isArray(manifest?.groups) || manifest.groups.length === 0) {
    throw new Error('Integration manifest must contain at least one group.');
  }
  return manifest;
}

// Intent名、統合モード、source commit、最終メッセージを実体へ解決する。
function resolveGroups(root, groups) {
  return groups.map((group, index) => {
    if (!group || typeof group !== 'object') {
      throw new Error(`Integration group ${index + 1} is invalid.`);
    }
    const intent = String(group.intent ?? '').trim();
    if (!intent) throw new Error(`Integration group ${index + 1} is missing Intent.`);
    const mode = group.mode === 'intent' ? 'intent' : group.mode === 'unit' ? 'unit' : null;
    if (!mode) throw new Error(`Integration group "${intent}" must use mode "unit" or "intent".`);
    if (!Array.isArray(group.commits) || group.commits.length === 0) {
      throw new Error(`Integration group "${intent}" needs commits.`);
    }
    const message = normalizeCommitMessage(group.message, { allowUnit: false });
    return {
      intent,
      mode,
      commits: group.commits.map((commit) => resolveCommit(root, commit)),
      message,
    };
  });
}

// 履歴操作やcommit hookが失敗したとき、元のHEADと作業状態へ戻す。
function recoverOriginalTree(root, head) {
  const reset = runGit(root, ['reset', '--mixed', head]);
  if (!reset.ok) return `Recovery also failed: ${reset.message}`;
  const restore = runGit(root, ['restore', '--source', head, '--staged', '--worktree', '--', '.']);
  return restore.ok
    ? 'The original HEAD, index, and worktree were restored.'
    : `Recovery also failed: ${restore.message}`;
}

// 統合中にユーザーの未保存変更を巻き込まないため、開始前にcleanを要求する。
function ensureCleanWorktree(root) {
  const status = runGit(root, ['status', '--porcelain']);
  if (!status.ok) throw new Error(status.message);
  if (bufferText(status.stdout).trim()) {
    throw new Error('Intent integration requires a clean worktree and index.');
  }
}

// 任意のrefをcommit objectへ解決し、以降の比較をハッシュで統一する。
function resolveCommit(root, ref) {
  return resolveRef(root, `${ref}^{commit}`);
}

// source範囲の先頭が単一親を持つことを確認して、baseとの直結を調べる。
function resolveParent(root, commit) {
  const parents = readParents(root, commit);
  if (parents.length !== 1) throw new Error(`Commit is not linear: ${commit}`);
  return parents[0];
}

// linear history判定に使う親commit一覧をGitから取得する。
function readParents(root, commit) {
  const result = runGit(root, ['rev-list', '--parents', '-n', '1', commit]);
  if (!result.ok) throw new Error(result.message);
  const fields = bufferText(result.stdout).trim().split(/\s+/);
  return fields.slice(1);
}

// Unit形式のsource commitを判定するため、subjectだけを読む。
function readSubject(root, commit) {
  const result = runGit(root, ['log', '-1', '--format=%s', commit]);
  if (!result.ok) throw new Error(result.message);
  return bufferText(result.stdout).trim();
}

// 単一Intent sourceのWhy/What/Verify形式を検証するため、全文を読む。
function readMessage(root, commit) {
  const result = runGit(root, ['log', '-1', '--format=%B', commit]);
  if (!result.ok) throw new Error(result.message);
  return bufferText(result.stdout);
}

// treeやcommitなどのGit refを検証付きで解決する。
function resolveRef(root, ref) {
  const result = runGit(root, ['rev-parse', '--verify', ref]);
  if (!result.ok) throw new Error(result.message);
  return bufferText(result.stdout).trim();
}

// CLIのroot、base、manifest入力を解析し、履歴操作に必要な値だけを残す。
function parseArgs(argv) {
  const args = { root: null, base: null, manifestStdin: false };
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
    if (value === '--manifest-stdin') {
      args.manifestStdin = true;
      continue;
    }
    throw new Error(`Unknown argument: ${value}`);
  }
  if (!args.base) throw new Error('Use --base <commit> for the source base.');
  return args;
}

// Skillが機械的に後続処理できる結果だけをJSONで返す。
function emit(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

// GitのBuffer出力をエラーメッセージや比較に使える文字列へ揃える。
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
  // 失敗した処理のError messageを、JSON応答へ安定して変換する。
  return error instanceof Error ? error.message : String(error);
}

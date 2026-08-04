#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { normalizeCommitMessage } from '../../lib/commit-message.mjs';

const MODES = ['A', 'B', 'C'];
const BRANCH_OPERATIONS = {
  A: 'none',
  B: 'intermediate',
  C: 'temporary-cherry-pick',
};

// baseからdelivery headまでのIntent統合commitを棚卸しし、必要なら3案の計画も検証する。
export function main({ argv = process.argv.slice(2), cwd = process.cwd(), input = null } = {}) {
  try {
    const args = parseArgs(argv);
    const root = resolve(args.root ?? cwd);
    const inventory = inventoryCommits(root, args.base, args.head ?? 'HEAD');
    if (!args.proposalStdin) {
      emit({ ...inventory, status: 'inventoried' });
      return 0;
    }

    const proposalInput = parseJson(input ?? readStdin());
    const plan = proposalInput.plan ?? proposalInput;
    const validation = validateProposals(inventory, plan);
    emit({ ...inventory, status: 'validated', proposals: validation, plan });
    return 0;
  } catch (error) {
    emit({ ok: false, status: 'rejected', message: errorMessage(error) });
    return 1;
  }
}

// source historyの範囲、直線性、commit形式、変更Pathをdelivery headまで確定する。
export function inventoryCommits(root, baseRef, headRef = 'HEAD') {
  ensureCleanWorktree(root);
  const base = resolveCommit(root, baseRef);
  const head = resolveCommit(root, headRef);
  const currentHead = resolveCommit(root, 'HEAD');
  const deferredCommits = readDeferredCommits(root, head, currentHead);
  const refs = readLines(runGit(root, ['rev-list', '--reverse', `${base}..${head}`]).stdout);
  if (refs.length === 0) {
    throw new Error('The source range contains no Intent integration commits.');
  }

  const commits = [];
  let previous = base;
  for (const sha of refs) {
    const parents = readParents(root, sha);
    if (parents.length !== 1) throw new Error(`Source commit is not linear: ${sha}`);
    if (parents[0] !== previous) {
      throw new Error(`Source commit range is not contiguous at ${sha}.`);
    }

    const message = normalizeCommitMessage(readMessage(root, sha), { allowUnit: false });
    const files = readNumstat(root, parents[0], sha);
    if (files.length === 0) throw new Error(`Source commit has no changed paths: ${sha}`);

    commits.push({
      sha,
      parent: parents[0],
      subject: message.split('\n', 1)[0],
      message,
      files,
      paths: files.map((file) => file.path),
      lines: sumChangedLines(files),
    });
    previous = sha;
  }

  return {
    ok: true,
    base,
    baseRef: baseRef ?? 'HEAD',
    head,
    headRef,
    currentHead,
    deferredCommits,
    commits,
    paths: [...new Set(commits.flatMap((commit) => commit.paths))],
    lines: sumChangedLines(commits.flatMap((commit) => commit.files)),
  };
}

// 現在HEADより手前のdelivery headを指定した場合、後続commitをPR対象外として記録する。
function readDeferredCommits(root, deliveryHead, currentHead) {
  if (deliveryHead === currentHead) return [];
  const ancestry = runGit(root, ['merge-base', '--is-ancestor', deliveryHead, currentHead], {
    allowFailure: true,
  });
  if (ancestry.status !== 0) {
    throw new Error('Delivery head must be an ancestor of the current HEAD.');
  }
  const refs = readLines(
    runGit(root, ['rev-list', '--reverse', `${deliveryHead}..${currentHead}`]).stdout,
  );
  return refs.map((sha) => ({
    sha,
    subject: readSubject(root, sha),
  }));
}

// A/B/Cそれぞれで、commitの漏れ・重複・Path不一致・方式違反を検証する。
export function validateProposals(inventory, input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('Proposal input must be a JSON object.');
  }
  const proposals = input.proposals;
  if (!proposals || typeof proposals !== 'object' || Array.isArray(proposals)) {
    throw new Error('Proposal input must contain A, B, and C proposals.');
  }

  const results = {};
  for (const mode of MODES) {
    if (!proposals[mode]) throw new Error(`Proposal mode ${mode} is missing.`);
    results[mode] = validateProposal(inventory, mode, proposals[mode]);
  }
  return results;
}

// 一つの方式内で全source commitを一度だけPRへ割り当てる。
function validateProposal(inventory, mode, proposal) {
  if (!proposal || typeof proposal !== 'object' || Array.isArray(proposal)) {
    throw new Error(`Proposal mode ${mode} must be an object.`);
  }
  if (proposal.mode !== mode) throw new Error(`Proposal mode ${mode} has an invalid mode field.`);
  if (!Array.isArray(proposal.prs) || proposal.prs.length === 0) {
    throw new Error(`Proposal mode ${mode} must contain at least one PR.`);
  }

  const sourceBySha = new Map(
    inventory.commits.map((commit, index) => [commit.sha, { commit, index }]),
  );
  const prIds = new Set();
  const seen = new Set();
  let previousIndex = -1;

  for (const [prIndex, pr] of proposal.prs.entries()) {
    validatePrFields(mode, pr, prIds);
    validateProposalBase(inventory, mode, pr, prIndex);
    const sourceCommits = resolveSourceCommits(sourceBySha, mode, pr.commits);
    const indices = sourceCommits.map(({ index }) => index);
    validatePathUnion(
      pr,
      sourceCommits.map(({ commit }) => commit),
    );

    for (const sha of pr.commits) {
      if (seen.has(sha)) throw new Error(`Proposal mode ${mode} repeats source commit: ${sha}`);
      seen.add(sha);
    }

    if (mode === 'B') {
      if (indices[0] !== previousIndex + 1) {
        throw new Error(`Proposal mode B is not source-contiguous at PR "${pr.id}".`);
      }
      if (!indices.every((index, offset) => index === indices[0] + offset)) {
        throw new Error(`Proposal mode B splits source order inside PR "${pr.id}".`);
      }
      previousIndex = indices.at(-1);
    }
    if (
      mode === 'C' &&
      !indices.every((index, offset) => offset === 0 || index > indices[offset - 1])
    ) {
      throw new Error(`Proposal mode C must list source commits in source order at PR "${pr.id}".`);
    }

    validateDependencies(pr, prIds, mode);
  }

  if (mode === 'A' && proposal.prs.length !== 1) {
    throw new Error('Proposal mode A must contain exactly one PR.');
  }
  if (
    mode === 'A' &&
    proposal.prs[0].commits.some((sha, index) => sha !== inventory.commits[index]?.sha)
  ) {
    throw new Error('Proposal mode A must preserve source commit order.');
  }
  if (seen.size !== inventory.commits.length) {
    throw new Error(`Proposal mode ${mode} does not account for every source commit.`);
  }
  for (const commit of inventory.commits) {
    if (!seen.has(commit.sha))
      throw new Error(`Proposal mode ${mode} omits source commit: ${commit.sha}`);
  }

  return {
    mode,
    prCount: proposal.prs.length,
    sourceCommits: inventory.commits.length,
    paths: [...new Set(proposal.prs.flatMap((pr) => pr.paths))],
  };
}

// root baseから開始するPRだけ、合意したbase refを使うことを確認する。
function validateProposalBase(inventory, mode, pr, prIndex) {
  const dependencies = pr.dependsOn ?? [];
  const requiresRootBase =
    mode === 'A' || (mode === 'B' && prIndex === 0) || (mode === 'C' && dependencies.length === 0);
  if (requiresRootBase && String(pr.base).trim() !== inventory.baseRef) {
    throw new Error(
      `PR "${pr.id}" must use inventory base "${inventory.baseRef}" as its base ref.`,
    );
  }
}

// PR単位の説明とref操作を、3方式共通の必須フィールドとして確認する。
function validatePrFields(mode, pr, prIds) {
  if (!pr || typeof pr !== 'object' || Array.isArray(pr)) {
    throw new Error(`Proposal mode ${mode} contains an invalid PR.`);
  }
  const id = String(pr.id ?? '').trim();
  if (!id) throw new Error(`Proposal mode ${mode} contains a PR without an id.`);
  if (prIds.has(id)) throw new Error(`Proposal mode ${mode} repeats PR id: ${id}`);
  prIds.add(id);

  for (const field of ['intent', 'behavior', 'base', 'head']) {
    if (!String(pr[field] ?? '').trim()) {
      throw new Error(`PR "${id}" is missing ${field}.`);
    }
  }
  if (pr.branchOperation !== BRANCH_OPERATIONS[mode]) {
    throw new Error(`PR "${id}" has an invalid branch operation for mode ${mode}.`);
  }
  if (!Array.isArray(pr.commits) || pr.commits.length === 0) {
    throw new Error(`PR "${id}" must contain source commits.`);
  }
  if (!Array.isArray(pr.paths) || pr.paths.length === 0) {
    throw new Error(`PR "${id}" must contain Paths.`);
  }
}

// 計画上のPathが、含めたsource commitの変更Pathのunionと一致することを確認する。
function validatePathUnion(pr, sourceCommits) {
  const expected = [...new Set(sourceCommits.flatMap((commit) => commit.paths))].toSorted();
  const actual = [
    ...new Set(pr.paths.map((path) => String(path).trim()).filter(Boolean)),
  ].toSorted();
  if (expected.length !== actual.length || expected.some((path, index) => path !== actual[index])) {
    throw new Error(`PR "${pr.id}" Paths do not match its source commits.`);
  }
}

// 依存先は同じproposal内の既知PRだけに限定し、自己依存を拒否する。
function validateDependencies(pr, knownIds, mode) {
  const dependencies = pr.dependsOn ?? [];
  if (!Array.isArray(dependencies)) throw new Error(`PR "${pr.id}" dependsOn must be an array.`);
  if (mode === 'C' && dependencies.length > 1) {
    throw new Error(`PR "${pr.id}" in mode C may depend on at most one PR.`);
  }
  for (const dependency of dependencies) {
    if (dependency === pr.id) throw new Error(`PR "${pr.id}" cannot depend on itself.`);
    if (!knownIds.has(dependency)) {
      throw new Error(`PR "${pr.id}" depends on an unknown PR: ${dependency}`);
    }
  }
}

// proposalが参照するSHAをinventory上の完全なsource commitへ解決する。
function resolveSourceCommits(sourceBySha, mode, refs) {
  return refs.map((ref) => {
    const source = sourceBySha.get(ref);
    if (!source)
      throw new Error(`Proposal mode ${mode} references an unknown source commit: ${ref}`);
    return source;
  });
}

// working treeを空にして、PR候補がcommit済み履歴だけから作られることを保証する。
function ensureCleanWorktree(root) {
  const status = runGit(root, ['status', '--porcelain']).stdout.trim();
  if (status) throw new Error('Pull request inventory requires a clean worktree and index.');
}

// commit refを完全なSHAへ解決する。
function resolveCommit(root, ref) {
  return runGit(root, ['rev-parse', '--verify', `${ref}^{commit}`]).stdout.trim();
}

// linear historyの親commitを読む。
function readParents(root, sha) {
  const fields = runGit(root, ['rev-list', '--parents', '-n', '1', sha]).stdout.trim().split(/\s+/);
  return fields.slice(1);
}

// Intent統合messageを検証するため、commit本文全体を読む。
function readMessage(root, sha) {
  return runGit(root, ['log', '-1', '--format=%B', sha]).stdout;
}

// PR対象外の後続commitを追跡用のsubjectだけで表示する。
function readSubject(root, sha) {
  return runGit(root, ['log', '-1', '--format=%s', sha]).stdout.trim();
}

// source commitごとの追加・削除行数と変更Pathを読む。
function readNumstat(root, parent, sha) {
  const output = runGit(root, [
    'diff',
    '--numstat',
    '--no-renames',
    '-z',
    parent,
    sha,
    '--',
  ]).stdout;
  return output
    .split('\0')
    .filter(Boolean)
    .map((record) => {
      const fields = record.split('\t');
      if (fields.length < 3) throw new Error(`Invalid numstat record in ${sha}.`);
      const additions = parseLineCount(fields[0]);
      const deletions = parseLineCount(fields[1]);
      const path = fields.slice(2).join('\t');
      return {
        path,
        additions,
        deletions,
        changedLines: additions === null || deletions === null ? null : additions + deletions,
        measurable: additions !== null && deletions !== null,
      };
    });
}

// binary差分の「-」は行数不明として保持する。
function parseLineCount(value) {
  return value === '-' ? null : Number.parseInt(value, 10);
}

// 全ファイルを測定できる場合だけ合計値を返す。
function sumChangedLines(files) {
  return files.every((file) => file.changedLines !== null)
    ? files.reduce((sum, file) => sum + file.changedLines, 0)
    : null;
}

// CLI引数からroot、base、delivery head、proposal検証モードを読み取る。
function parseArgs(argv) {
  const args = { root: null, base: null, head: null, proposalStdin: false };
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
    if (value === '--head') {
      args.head = argv[index + 1];
      index += 1;
      continue;
    }
    if (value === '--proposal-stdin') {
      args.proposalStdin = true;
      continue;
    }
    throw new Error(`Unknown argument: ${value}`);
  }
  if (!args.base) throw new Error('Use --base <commit> for the source base.');
  return args;
}

// proposal JSONを標準入力から受け取る。
function readStdin() {
  return readFileSync(0, 'utf8');
}

// JSON本文を検証して、壊れたproposalを早期に拒否する。
function parseJson(input) {
  try {
    return JSON.parse(String(input ?? ''));
  } catch (error) {
    throw new Error(`Proposal input is not valid JSON: ${errorMessage(error)}`, { cause: error });
  }
}

// Gitの改行区切り出力を空行なしの配列へ変換する。
function readLines(output) {
  return String(output ?? '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

// Gitコマンドを実行し、通常は失敗を隠さず、存在確認だけallowFailureを許可する。
function runGit(root, args, { allowFailure = false } = {}) {
  const result = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
  if (result.error && !allowFailure)
    throw new Error(`Could not run git: ${result.error.message}`, { cause: result.error });
  if (!allowFailure && result.status !== 0) {
    throw new Error(
      result.stderr?.trim() || `git ${args.join(' ')} exited with status ${result.status}`,
    );
  }
  return result;
}

// Skillが受け取る機械可読な結果をJSONで出力する。
function emit(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

// CLIエラーを安定した文字列へ変換する。
function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : '';
if (invokedPath === fileURLToPath(import.meta.url)) {
  process.exitCode = main();
}

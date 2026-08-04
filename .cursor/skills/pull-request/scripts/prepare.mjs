#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { inventoryCommits, validateProposals } from './inventory.mjs';

const MODES = new Set(['A', 'B', 'C']);

// 選択済みModeだけを検証し、必要ならbranch/worktreeを準備する。
export function main({ argv = process.argv.slice(2), cwd = process.cwd(), input = null } = {}) {
  try {
    const args = parseArgs(argv);
    const root = resolve(args.root ?? cwd);
    const proposalInput = parseJson(input ?? readStdin());
    const plan = proposalInput.plan ?? proposalInput;
    const inventory = inventoryCommits(root, args.base, args.head ?? 'HEAD');
    validateProposals(inventory, plan);
    const proposal = plan.proposals[args.mode];
    const prepared = prepareMode(root, inventory, proposal, args.mode, {
      branchPrefix: args.branchPrefix,
    });
    emit({
      ok: true,
      status: 'prepared',
      mode: args.mode,
      base: inventory.base,
      sourceHead: inventory.head,
      sourceHeadRef: inventory.headRef,
      currentHead: inventory.currentHead,
      deferredCommits: inventory.deferredCommits,
      prs: prepared,
    });
    return 0;
  } catch (error) {
    emit({ ok: false, status: 'rejected', message: errorMessage(error) });
    return 1;
  }
}

// A/B/Cの差分を分け、Aは現状ref、B/Cは必要なhead refを返す。
export function prepareMode(root, inventory, proposal, mode, { branchPrefix = 'pr-content' } = {}) {
  if (mode === 'A') {
    const currentBranch = readCurrentBranch(root);
    return proposal.prs.map((pr) => {
      const head = normalizePublishBranch(isPlaceholder(pr.head) ? currentBranch : pr.head);
      ensureDeliveryHead(root, head, inventory.head);
      return {
        ...pr,
        sourceCommits: pr.commits,
        head,
        preparedHead: head,
        expectedHead: inventory.head,
        sourceToPrepared: pr.commits.map((sha) => ({ source: sha, prepared: sha })),
      };
    });
  }
  if (mode === 'B') return prepareStackedBranches(root, proposal.prs, branchPrefix);
  if (mode === 'C') return prepareContentBranches(root, proposal.prs, branchPrefix);
  throw new Error(`Unknown PR preparation mode: ${mode}`);
}

// A方式で現在branchをheadとして使うため、detached HEADは拒否する。
function readCurrentBranch(root) {
  const branch = runGit(root, ['branch', '--show-current']).stdout.trim();
  if (!branch) throw new Error('Mode A requires a named current branch.');
  return branch;
}

// 計画例のplaceholderは、準備時に実際のrefへ置き換える。
function isPlaceholder(value) {
  return String(value ?? '').includes('<');
}

// remote tracking refを指定しても、GitHubへ渡すpublishable branch名へ戻す。
function normalizePublishBranch(value) {
  const branch = String(value ?? '').trim();
  return branch.startsWith('origin/') ? branch.slice('origin/'.length) : branch;
}

// Bはsource orderの各連続範囲の末尾commitへbranch refだけを作る。
function prepareStackedBranches(root, prs, branchPrefix) {
  ensureUniqueBranchNames(prs, branchPrefix);
  const prepared = [];
  let previousHead = null;
  let previousPr = null;
  for (const pr of prs) {
    const branch = branchName(branchPrefix, pr.id);
    const target = pr.commits.at(-1);
    const branchCreated = ensureBranch(root, branch, target);
    const base = previousHead ?? pr.base;
    const dependsOn = previousPr
      ? [...new Set([...(pr.dependsOn ?? []), previousPr.id])]
      : (pr.dependsOn ?? []);
    prepared.push({
      ...pr,
      base,
      head: branch,
      preparedHead: branch,
      sourceCommits: pr.commits,
      sourceToPrepared: pr.commits.map((sha) => ({ source: sha, prepared: sha })),
      expectedHead: target,
      dependsOn,
      branchCreated,
    });
    previousHead = branch;
    previousPr = pr;
  }
  return prepared;
}

// Cは候補ごとに一時worktreeで完全commitをcherry-pickし、新しいhead branchを作る。
function prepareContentBranches(root, prs, branchPrefix) {
  ensureUniqueBranchNames(prs, branchPrefix);
  const prepared = [];
  const preparedById = new Map();
  for (const pr of prs) {
    const branch = branchName(branchPrefix, pr.id);
    const base = resolveDependencyBase(pr, preparedById);
    const preparedPr = prepareContentBranch(root, pr, branch, base);
    prepared.push(preparedPr);
    preparedById.set(pr.id, preparedPr);
  }
  return prepared;
}

// 一つのC候補だけを分離して作り、失敗時はその候補の副作用だけを戻す。
function prepareContentBranch(root, pr, branch, base) {
  const worktree = mkdtempSync(join(tmpdir(), 'pull-request-content-'));
  let branchCreated = false;
  let worktreeAdded = false;
  let preparedPr;
  try {
    ensureBranchAbsent(root, branch);
    runGit(root, ['worktree', 'add', '-b', branch, worktree, base]);
    branchCreated = true;
    worktreeAdded = true;
    const sourceToPrepared = [];
    for (const source of pr.commits) {
      runGit(worktree, ['cherry-pick', source]);
      sourceToPrepared.push({ source, prepared: resolveCommit(worktree, 'HEAD') });
    }
    preparedPr = {
      ...pr,
      base,
      head: branch,
      preparedHead: branch,
      sourceCommits: pr.commits,
      sourceToPrepared,
      expectedHead: resolveCommit(root, branch),
      branchCreated,
    };
  } catch (error) {
    recoverCherryPick(root, worktree, branch, branchCreated, worktreeAdded, error);
  }

  try {
    removeWorktree(root, worktree);
  } catch (error) {
    throw new Error(
      `Prepared branch "${branch}" is ready, but its worktree could not be removed.`,
      { cause: error },
    );
  }
  return preparedPr;
}

// 依存PRがあれば、その準備済みheadをbaseとしてStackedな内容PRを作る。
function resolveDependencyBase(pr, preparedById) {
  const dependency = pr.dependsOn?.[0];
  if (!dependency) return pr.base;
  const prepared = preparedById.get(dependency);
  if (!prepared) throw new Error(`PR "${pr.id}" depends on an unprepared PR: ${dependency}`);
  return prepared.head;
}

// 既存branchが同じtargetなら再利用し、違えば履歴を上書きせず停止する。
function ensureBranch(root, branch, target) {
  const existing = findLocalBranch(root, branch);
  if (existing) {
    if (existing !== target) {
      throw new Error(`Branch "${branch}" already points to ${existing}, expected ${target}.`);
    }
    return false;
  }
  runGit(root, ['branch', branch, target]);
  return true;
}

// Cの一時branchは既存refを上書きしない。
function ensureBranchAbsent(root, branch) {
  if (findLocalBranch(root, branch)) {
    throw new Error(`Temporary branch already exists: ${branch}`);
  }
}

// cherry-pick失敗時は途中状態をabortし、作成したbranchだけを安全に掃除する。
function recoverCherryPick(root, worktree, branch, branchCreated, worktreeAdded, originalError) {
  try {
    if (worktreeAdded) {
      runGit(worktree, ['cherry-pick', '--abort'], { allowFailure: true });
      removeWorktree(root, worktree);
    } else {
      rmSync(worktree, { recursive: true, force: true });
    }
    if (branchCreated) runGit(root, ['branch', '-D', branch]);
  } catch (cleanupError) {
    throw new Error(
      `${errorMessage(originalError)} Cleanup failed: ${errorMessage(cleanupError)}`,
      { cause: cleanupError },
    );
  }
  throw originalError;
}

// worktreeを削除し、元のcurrent worktreeを汚さない。
function removeWorktree(root, worktree) {
  const result = runGit(root, ['worktree', 'remove', '--force', worktree], { allowFailure: true });
  if (result.status !== 0) {
    throw new Error(result.stderr?.trim() || `Could not remove worktree: ${worktree}`);
  }
  rmSync(worktree, { recursive: true, force: true });
}

// PR IDをbranch名へ変換し、意図しないGit ref文字を排除する。
function branchName(prefix, id) {
  const safePrefix = sanitizeBranchPart(prefix);
  const safeId = sanitizeBranchPart(id);
  return `${safePrefix}/${safeId}`;
}

// branch名に使えない文字を固定のハイフンへ置換する。
function sanitizeBranchPart(value) {
  const sanitized = String(value ?? '')
    .trim()
    .replace(/[^a-zA-Z0-9._/-]+/g, '-')
    .replace(/\/+/g, '/')
    .replace(/^[-/.]+|[-/.]+$/g, '');
  if (!sanitized) throw new Error('Branch name component must not be empty.');
  return sanitized;
}

// 異なるPR IDが同じbranch名へ正規化される場合は、refの誤共有を防いで停止する。
function ensureUniqueBranchNames(prs, branchPrefix) {
  const branchOwners = new Map();
  for (const pr of prs) {
    const branch = branchName(branchPrefix, pr.id);
    const previousId = branchOwners.get(branch);
    if (previousId) {
      throw new Error(
        `PR ids "${previousId}" and "${pr.id}" collide after branch sanitization: ${branch}`,
      );
    }
    branchOwners.set(branch, pr.id);
  }
}

// local branchの現在SHAを取得し、存在しない場合だけnullを返す。
function findLocalBranch(root, branch) {
  const result = runGit(root, ['rev-parse', '--verify', `refs/heads/${branch}`], {
    allowFailure: true,
  });
  return result.status === 0 ? result.stdout.trim() : null;
}

// partial deliveryでは、local branchが後続commitを持っていてもremote headを採用できる。
function findRemoteBranch(root, branch) {
  const result = runGit(root, ['rev-parse', '--verify', `refs/remotes/origin/${branch}`], {
    allowFailure: true,
  });
  return result.status === 0 ? result.stdout.trim() : null;
}

// A方式が参照するbranchが、合意したdelivery headを指すことを確認する。
function ensureDeliveryHead(root, branch, expectedHead) {
  const local = findLocalBranch(root, branch);
  const remote = findRemoteBranch(root, branch);
  if (local !== expectedHead && remote !== expectedHead) {
    throw new Error(
      `PR head "${branch}" does not point to delivery head ${expectedHead}; choose a ref at the agreed boundary.`,
    );
  }
}

// CLI引数を解析し、Mode選択を必須にする。
function parseArgs(argv) {
  const args = {
    root: null,
    base: null,
    head: null,
    mode: null,
    branchPrefix: 'pr-content',
  };
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
    if (value === '--mode') {
      args.mode = argv[index + 1];
      index += 1;
      continue;
    }
    if (value === '--branch-prefix') {
      args.branchPrefix = argv[index + 1];
      index += 1;
      continue;
    }
    if (value === '--proposal-stdin') continue;
    throw new Error(`Unknown argument: ${value}`);
  }
  if (!args.base) throw new Error('Use --base <commit> for the source base.');
  if (!MODES.has(args.mode)) throw new Error('Use --mode A, B, or C.');
  return args;
}

// proposal JSONを標準入力から読む。
function readStdin() {
  return readFileSync(0, 'utf8');
}

// proposal本文をJSONとして解釈する。
function parseJson(input) {
  try {
    return JSON.parse(String(input ?? ''));
  } catch (error) {
    throw new Error(`Proposal input is not valid JSON: ${errorMessage(error)}`, { cause: error });
  }
}

// refを完全なcommit SHAへ解決する。
function resolveCommit(root, ref) {
  return runGit(root, ['rev-parse', '--verify', `${ref}^{commit}`]).stdout.trim();
}

// Git操作を実行し、allowFailure以外の失敗を即座に返す。
function runGit(root, args, { allowFailure = false } = {}) {
  const result = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
  if (result.error && !allowFailure) {
    throw new Error(`Could not run git: ${result.error.message}`, { cause: result.error });
  }
  if (!allowFailure && result.status !== 0) {
    throw new Error(
      result.stderr?.trim() || `git ${args.join(' ')} exited with status ${result.status}`,
    );
  }
  return result;
}

// 結果をSkillが次のgh操作へ渡せるJSONで出力する。
function emit(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

// エラーを安定したメッセージへ変換する。
function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : '';
if (invokedPath === fileURLToPath(import.meta.url)) {
  process.exitCode = main();
}

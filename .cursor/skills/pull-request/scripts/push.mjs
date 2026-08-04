#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

// 選択したPR headだけをremoteへ公開し、PR作成用の証跡を返す。
export function main({
  argv = process.argv.slice(2),
  cwd = process.cwd(),
  input = null,
  runGitCommand = runGit,
} = {}) {
  try {
    const args = parseArgs(argv);
    const root = resolve(args.root ?? cwd);
    const prepared = parseJson(input ?? readStdin());
    const result = publishPrepared({
      root,
      prepared,
      selectedPrIds: args.all ? prepared.prs?.map((pr) => pr.id) : args.prIds,
      runGitCommand,
    });
    emit({ ...prepared, ok: true, status: 'published', ...result });
    return 0;
  } catch (error) {
    emit({
      ok: false,
      status: 'rejected',
      message: errorMessage(error),
      publication: error.publication ?? [],
    });
    return 1;
  }
}

// 全候補または明示選択候補の依存関係を確認してから、headを順に公開する。
export function publishPrepared({ root, prepared, selectedPrIds, runGitCommand = runGit }) {
  validatePrepared(prepared);
  const selected = selectPreparedPrs(prepared.prs, selectedPrIds);
  const publication = [];
  for (const pr of selected) {
    try {
      publication.push(publishHead(root, pr, runGitCommand));
    } catch (error) {
      const failure = new Error(
        `${errorMessage(error)} Published before failure: ${publication.map((entry) => entry.id).join(', ') || 'none'}.`,
        { cause: error },
      );
      failure.publication = publication;
      throw failure;
    }
  }
  return {
    selectedPrIds: selected.map((pr) => pr.id),
    publication,
  };
}

// 選択されたPRが存在し、依存PRも同時に選択されていることを確認する。
function selectPreparedPrs(prs, selectedPrIds) {
  if (!Array.isArray(selectedPrIds) || selectedPrIds.length === 0) {
    throw new Error('Select at least one PR to publish.');
  }
  const byId = new Map(prs.map((pr) => [pr.id, pr]));
  const selectedIds = new Set(selectedPrIds);
  if (selectedIds.size !== selectedPrIds.length) {
    throw new Error('The publish selection repeats a PR.');
  }
  const selected = selectedPrIds.map((id) => {
    const pr = byId.get(id);
    if (!pr) throw new Error(`Publish selection references an unknown PR: ${id}`);
    return pr;
  });
  for (const pr of selected) {
    for (const dependency of pr.dependsOn ?? []) {
      if (!selectedIds.has(dependency)) {
        throw new Error(`PR "${pr.id}" requires dependency "${dependency}" to be selected.`);
      }
    }
  }
  // prepared.prsは依存先が先に並ぶため、CLI指定順ではなく安全な公開順を維持する。
  return prs.filter((pr) => selectedIds.has(pr.id));
}

// remoteが既に同じheadならno-op、未公開ならforceなしでpushする。
function publishHead(root, pr, runGitCommand) {
  const remoteHead = findRemoteHead(root, pr.head, runGitCommand);
  if (remoteHead === pr.expectedHead) {
    return publicationResult(pr, 'already_published');
  }

  const localHead = findLocalHead(root, pr.head, runGitCommand);
  if (localHead !== pr.expectedHead) {
    throw new Error(
      `PR "${pr.id}" head "${pr.head}" is ${localHead ?? 'not local'}, expected ${pr.expectedHead}.`,
    );
  }
  runGitCommand(root, ['push', '--set-upstream', 'origin', pr.head]);
  return publicationResult(pr, 'pushed');
}

// PR作成側でheadとdelivery boundaryを照合できる形へ整える。
function publicationResult(pr, status) {
  return {
    id: pr.id,
    head: pr.head,
    expectedHead: pr.expectedHead,
    status,
  };
}

// prepared JSONがpublish可能なMode、branch、delivery headを持つことを確認する。
function validatePrepared(prepared) {
  if (!prepared || typeof prepared !== 'object' || !['A', 'B', 'C'].includes(prepared.mode)) {
    throw new Error('Prepared input must contain mode A, B, or C.');
  }
  if (!Array.isArray(prepared.prs) || prepared.prs.length === 0) {
    throw new Error('Prepared input must contain at least one PR.');
  }
  const ids = new Set();
  for (const pr of prepared.prs) {
    if (ids.has(pr.id)) throw new Error(`Prepared input repeats PR id: ${pr.id}`);
    ids.add(pr.id);
    for (const field of ['id', 'base', 'head', 'expectedHead']) {
      if (!String(pr[field] ?? '').trim() || String(pr[field]).includes('<')) {
        throw new Error(`Prepared PR "${pr.id ?? '?'}" has an invalid ${field}.`);
      }
    }
    if (!Array.isArray(pr.dependsOn)) {
      throw new Error(`Prepared PR "${pr.id}" dependsOn must be an array.`);
    }
  }
}

// remote branchの実体を確認し、既存のremote headを誤って上書きしない。
function findRemoteHead(root, branch, runGitCommand) {
  const result = runGitCommand(root, ['ls-remote', '--heads', 'origin', `refs/heads/${branch}`]);
  const line = result.stdout.trim().split(/\r?\n/).find(Boolean);
  return line ? line.split(/\s+/)[0] : null;
}

// local branchの実体を確認し、delivery headと異なる変更をpushしない。
function findLocalHead(root, branch, runGitCommand) {
  const result = runGitCommand(root, ['rev-parse', '--verify', `refs/heads/${branch}`], {
    allowFailure: true,
  });
  return result.status === 0 ? result.stdout.trim() : null;
}

// CLI引数からrootと、全件または明示したPR IDを受け取る。
function parseArgs(argv) {
  const args = { root: null, all: false, prIds: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === '--root') {
      args.root = argv[index + 1];
      index += 1;
      continue;
    }
    if (value === '--pr') {
      args.prIds.push(argv[index + 1]);
      index += 1;
      continue;
    }
    if (value === '--all') {
      args.all = true;
      continue;
    }
    if (value === '--prepared-stdin') continue;
    throw new Error(`Unknown argument: ${value}`);
  }
  if (args.all && args.prIds.length > 0) {
    throw new Error('Use --all or --pr, not both.');
  }
  if (!args.all && args.prIds.length === 0) {
    throw new Error('Use --all or at least one --pr <id>.');
  }
  return args;
}

// prepared JSONを標準入力から読む。
function readStdin() {
  return readFileSync(0, 'utf8');
}

// prepared本文をJSONとして解釈する。
function parseJson(input) {
  try {
    return JSON.parse(String(input ?? ''));
  } catch (error) {
    throw new Error(`Prepared input is not valid JSON: ${errorMessage(error)}`, { cause: error });
  }
}

// Gitの結果をSkill間で渡せるJSONとして出力する。
function emit(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

// Git操作を実行し、allowFailure以外の失敗を公開処理の停止として扱う。
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

// Errorを安定したメッセージへ変換する。
function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : '';
if (invokedPath === fileURLToPath(import.meta.url)) {
  process.exitCode = main();
}

#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

// push済みproposalを使い、同一head/baseのPRを更新または作成する。
export function main({
  argv = process.argv.slice(2),
  cwd = process.cwd(),
  input = null,
  runGhCommand = runGh,
} = {}) {
  try {
    const args = parseArgs(argv);
    const root = resolve(args.root ?? cwd);
    const prepared = parseJson(input ?? readStdin());
    const result = createOrUpdatePullRequests({
      root,
      prepared,
      runGhCommand,
    });
    emit({ ok: true, status: 'pull_requests_ready', ...result });
    return 0;
  } catch (error) {
    emit({
      ok: false,
      status: 'rejected',
      message: errorMessage(error),
      pullRequests: error.pullRequests ?? [],
    });
    return 1;
  }
}

// push済みheadだけをGitHub上のPR操作へ渡す。
export function createOrUpdatePullRequests({ root, prepared, runGhCommand = runGh }) {
  const selectedPrs = validatePublished(prepared);
  const pullRequests = [];
  for (const pr of selectedPrs) {
    try {
      const body = buildPullRequestBody(prepared.mode, root, pr);
      const existing = findPullRequest(runGhCommand, root, pr.head, pr.base);
      if (existing) {
        runGhCommand(
          ['pr', 'edit', String(existing.number), '--title', pr.intent, '--body-file', '-'],
          { cwd: root, input: body },
        );
        pullRequests.push({
          ...prResult(pr),
          number: existing.number,
          url: existing.url,
          action: 'updated',
        });
        continue;
      }

      const output = runGhCommand(
        [
          'pr',
          'create',
          '--base',
          pr.base,
          '--head',
          pr.head,
          '--title',
          pr.intent,
          '--body-file',
          '-',
        ],
        { cwd: root, input: body },
      );
      pullRequests.push({ ...prResult(pr), url: String(output).trim(), action: 'created' });
    } catch (error) {
      const failure = new Error(
        `${errorMessage(error)} Pull requests completed before failure: ${
          pullRequests.map((entry) => entry.id).join(', ') || 'none'
        }.`,
        { cause: error },
      );
      failure.pullRequests = pullRequests;
      throw failure;
    }
  }

  return { mode: prepared.mode, pullRequests };
}

// PR本文を共通形式で作り、候補の意図とcommit対応をレビュー可能にする。
export function buildPullRequestBody(mode, root, pr) {
  const sourceCommits = pr.sourceCommits ?? pr.commits ?? [];
  const mappings = pr.sourceToPrepared ?? [];
  const commitLines = sourceCommits.map((sha) => {
    const mapping = mappings.find((entry) => entry.source === sha);
    const suffix = mapping && mapping.prepared !== sha ? ` → \`${mapping.prepared}\`` : '';
    return `- \`${sha}\`${suffix} ${readSubject(root, sha)}`;
  });
  const dependencies = pr.dependsOn?.length > 0 ? pr.dependsOn.map((id) => `- ${id}`) : ['- —'];
  const paths = pr.paths.map((path) => `- \`${path}\``);
  const note = pr.note ? pr.note : '—';

  return [
    `## Intent\n${pr.intent}`,
    `## Behavior\n${pr.behavior}`,
    `## Base\n${pr.base}`,
    `## Head\n${pr.head}`,
    `## Mode\n${mode}`,
    `## Source commits\n${commitLines.join('\n')}`,
    `## Paths\n${paths.join('\n')}`,
    `## Depends on\n${dependencies.join('\n')}`,
    `## Note\n${note}`,
    '',
  ].join('\n');
}

// PRの識別情報を、Skillが扱いやすい一定形へ整える。
function prResult(pr) {
  return { id: pr.id, intent: pr.intent, base: pr.base, head: pr.head };
}

// 同じhead/baseの既存PRを探し、更新対象を確定する。
function findPullRequest(runGhCommand, root, head, base) {
  const output = runGhCommand(
    [
      'pr',
      'list',
      '--state',
      'open',
      '--head',
      head,
      '--base',
      base,
      '--json',
      'number,url,state',
      '--limit',
      '1',
    ],
    { cwd: root },
  );
  let rows;
  try {
    rows = JSON.parse(String(output || '[]'));
  } catch (error) {
    throw new Error(`gh pr list returned invalid JSON: ${errorMessage(error)}`, { cause: error });
  }
  if (!Array.isArray(rows) || rows.length === 0) return null;
  const [row] = rows;
  if (!row.number || !row.url) throw new Error('gh pr list returned an incomplete PR record.');
  return row;
}

// push scriptの結果が選択済みModeと公開済みPR refsを持つことを確認する。
function validatePublished(prepared) {
  if (!prepared || typeof prepared !== 'object' || !['A', 'B', 'C'].includes(prepared.mode)) {
    throw new Error('Published input must contain mode A, B, or C.');
  }
  if (!Array.isArray(prepared.prs) || prepared.prs.length === 0) {
    throw new Error('Published input must contain at least one PR.');
  }
  if (!Array.isArray(prepared.selectedPrIds) || prepared.selectedPrIds.length === 0) {
    throw new Error('Published input must identify at least one selected PR.');
  }
  if (!Array.isArray(prepared.publication)) {
    throw new Error('Published input must contain push results from push.mjs.');
  }

  const prsById = new Map(prepared.prs.map((pr) => [pr.id, pr]));
  const publicationById = new Map(prepared.publication.map((entry) => [entry.id, entry]));
  const selectedIds = new Set(prepared.selectedPrIds);
  if (selectedIds.size !== prepared.selectedPrIds.length) {
    throw new Error('Published input repeats a selected PR.');
  }

  for (const id of selectedIds) {
    const pr = prsById.get(id);
    const publication = publicationById.get(id);
    if (!pr) throw new Error(`Published input selects an unknown PR: ${id}`);
    if (!Array.isArray(pr.dependsOn ?? [])) {
      throw new Error(`Published PR "${id}" dependsOn must be an array.`);
    }
    for (const dependency of pr.dependsOn ?? []) {
      if (!selectedIds.has(dependency)) {
        throw new Error(
          `PR "${id}" requires dependency "${dependency}" in the published selection.`,
        );
      }
    }
    if (!publication || !['pushed', 'already_published'].includes(publication.status)) {
      throw new Error(`PR "${id}" has no successful push result.`);
    }
    if (publication.head !== pr.head || publication.expectedHead !== pr.expectedHead) {
      throw new Error(`PR "${id}" push result does not match its prepared head.`);
    }
    for (const field of ['id', 'intent', 'behavior', 'base', 'head', 'expectedHead']) {
      if (!String(pr[field] ?? '').trim() || String(pr[field]).includes('<')) {
        throw new Error(`Prepared PR "${pr.id ?? '?'}" has an invalid ${field}.`);
      }
    }
    if (!Array.isArray(pr.paths) || pr.paths.length === 0) {
      throw new Error(`Prepared PR "${pr.id}" has no Paths.`);
    }
  }
  return prepared.prs.filter((pr) => selectedIds.has(pr.id));
}

// ghの標準出力を返し、失敗時はPR操作を停止する。
function runGh(args, { cwd = process.cwd(), input = null } = {}) {
  const result = spawnSync('gh', args, { cwd, encoding: 'utf8', input });
  if (result.error)
    throw new Error(`Could not run gh: ${result.error.message}`, { cause: result.error });
  if (result.status !== 0) {
    throw new Error(
      result.stderr?.trim() || `gh ${args.join(' ')} exited with status ${result.status}`,
    );
  }
  return result.stdout;
}

// source commitのsubjectを本文へ表示する。
function readSubject(root, sha) {
  const result = spawnSync('git', ['log', '-1', '--format=%s', sha], {
    cwd: root,
    encoding: 'utf8',
  });
  if (result.status !== 0)
    throw new Error(result.stderr?.trim() || `Could not read commit ${sha}.`);
  return result.stdout.trim();
}

// CLI引数からrootだけを受け取り、公開済みinputは標準入力へ委ねる。
function parseArgs(argv) {
  const args = { root: null };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === '--root') {
      args.root = argv[index + 1];
      index += 1;
      continue;
    }
    if (value === '--prepared-stdin' || value === '--published-stdin') continue;
    throw new Error(`Unknown argument: ${value}`);
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

// Skillが扱うPR URLと実行結果をJSONで返す。
function emit(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

// Errorを安定した文字列へ変換する。
function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : '';
if (invokedPath === fileURLToPath(import.meta.url)) {
  process.exitCode = main();
}

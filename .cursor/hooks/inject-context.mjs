#!/usr/bin/env node
/**
 * sessionStart でプロジェクト context を additional_context として注入する。
 * 対象: AGENTS.md / Spec / Issues / Cursor 特有（shell・web）/ Gate rules + Current values
 * 詳細手順は各 skill へ。state ファイルはここでは作らない（TTL 掃除のみ）。作成は初回ユーザー発話（beforeSubmitPrompt）。
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  conversationId,
  loadState,
  onSessionStart,
  statePathRelative,
  workspaceRoot,
} from './_state.mjs';

// null = 無制限 / 数値 = 文字数で機械カット
const MAX_CONTEXT_CHARS = 16000;

async function readStdinJson() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  const text = Buffer.concat(chunks).toString('utf8').trim();
  if (!text) return {};
  return JSON.parse(text);
}

function respond(payload) {
  process.stdout.write(JSON.stringify(payload) + '\n');
}

function sanitize(text) {
  return text.replace(/\r/g, '').replace(/\t/g, ' ');
}

function readIfExists(filePath, max) {
  if (!existsSync(filePath)) return '';
  try {
    const content = readFileSync(filePath, 'utf8');
    return sanitize(max ? content.slice(0, max) : content);
  } catch {
    return '';
  }
}

function ghJson(worktree, args) {
  try {
    const stdout = execFileSync('gh', args, {
      cwd: worktree,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return JSON.parse(stdout);
  } catch {
    return null;
  }
}

function readAgents(worktree) {
  return readIfExists(join(worktree, 'AGENTS.md'), 4000);
}

function readSpec(worktree) {
  const issues = ghJson(worktree, [
    'issue',
    'list',
    '--state',
    'open',
    '--json',
    'number,title,body',
    '--limit',
    '10',
  ]);
  if (!Array.isArray(issues)) {
    return 'No spec issue exists yet. Check if there are planning documents in the project (e.g., README.md, docs/). If so, review them and consider creating a spec issue to track the product design.';
  }
  const spec = issues.find((i) => typeof i.title === 'string' && i.title.startsWith('[Spec]'));
  if (!spec) {
    return 'No spec issue exists yet. Check if there are planning documents in the project (e.g., README.md, docs/). If so, review them and consider creating a spec issue to track the product design.';
  }
  return `### ${spec.title}\n\n${sanitize(spec.body || '')}`;
}

function readIssues(worktree) {
  const issues = ghJson(worktree, [
    'issue',
    'list',
    '--state',
    'open',
    '--json',
    'number,title,labels',
    '--limit',
    '5',
  ]);
  if (!Array.isArray(issues) || issues.length === 0) return '';
  return sanitize(
    issues
      .map((i) => {
        const labels =
          Array.isArray(i.labels) && i.labels.length > 0
            ? ` [${i.labels.map((l) => l.name).join(', ')}]`
            : '';
        return `- #${i.number} ${i.title}${labels}`;
      })
      .join('\n'),
  );
}

/** Cursor 特有: ワークスペース root 固定（エージェントが cd / git -C しがち） */
function readShell() {
  return 'Shell cwd is workspace root. Do not `cd` to root or `git -C <workspace-root>`. Subdir `cd` is fine.';
}

/** Cursor 特有: このリポの検索／取得の優先順位（MCP / 組み込みツール） */
function readWeb() {
  return [
    'Search: MCP `web_search_exa` (on 429 → built-in `WebSearch`).',
    'Fetch: built-in `WebFetch`. Library docs: Context7 first.',
  ].join('\n');
}

/** ゲート要点を1か所に（詳細は各 skill / deny メッセージ） */
function readGateRules() {
  return [
    'Phase: default `discussion`. Work only after user `/spec|/design|/forge|/refine|/chore`. Code → Read `implement/SKILL.md`. Trigger → `implement: false`, `readRefs: []`. Broken → user `/bootstrap` only.',
    'References: before gated edits, Read the matching `implement/references/*.md` (deny names the file). Do not edit state files.',
    'Review: `review.files` non-empty → commit blocked; `/pre-commit-reviewer` clears. `md` / `json` / `yaml` are not tracked.',
  ].join('\n');
}

function readGateState(root, id, stateFileRel) {
  const state = loadState(root, id);
  const review = state.review ?? { files: [] };
  const check = state.check ?? { pending: [] };
  return [
    `Gate state (hooks-only; do not edit): \`${stateFileRel}\``,
    'Name: `YYYYMMDD-HHmmss+0900__<conversation_id>.json`. `implement`: `null` in discussion; `false` = handshake pending; `true` = unlocked.',
    'Set `label` via `node .cursor/skills/label/scripts/set-label.mjs <label>`.',
    '',
    'Current values:',
    `phase: ${state.phase}`,
    `implement: ${state.implement}`,
    `label: ${state.label ? state.label : '(none)'}`,
    `review.files: ${JSON.stringify(review.files ?? [])}`,
    `check.pending: ${JSON.stringify(check.pending ?? [])}`,
    `readRefs: ${JSON.stringify(state.readRefs ?? [])}`,
  ].join('\n');
}

/** SECTION_DEFS が injected context の唯一の source of truth */
function buildSectionDefs(root, id, stateFileRel) {
  return [
    { id: 'agents', title: 'AGENTS.md', level: 1, codeblock: true, source: readAgents },
    { id: 'spec', title: 'Product Design', level: 1, source: readSpec },
    { id: 'issues', title: 'Open GitHub Issues', level: 2, codeblock: true, source: readIssues },
    // Cursor 特有ルール（他 IDE / 汎用エージェント向けではない）
    { id: 'shell', title: 'Shell cwd', level: 2, source: readShell },
    { id: 'web', title: 'Web tools', level: 2, source: readWeb },
    { id: 'gate-rules', title: 'Gate rules', level: 2, source: readGateRules },
    {
      id: 'gate',
      title: 'Gate state',
      level: 2,
      source: () => readGateState(root, id, stateFileRel),
    },
  ];
}

function renderSection(section) {
  const heading = '#'.repeat(section.level) + ' ' + section.title;
  const body = section.codeblock ? '```text\n' + section.body + '\n```' : section.body;
  return `${heading}\n\n${body}`;
}

function buildContext(worktree, root, id, stateFileRel) {
  const rendered = [];
  for (const def of buildSectionDefs(root, id, stateFileRel)) {
    const body = def.source(worktree);
    if (!body?.trim()) continue;
    rendered.push(renderSection({ ...def, body }));
  }
  const text = rendered.join('\n\n---\n\n');
  return MAX_CONTEXT_CHARS === null ? text : text.slice(0, MAX_CONTEXT_CHARS);
}

async function main() {
  const payload = await readStdinJson();

  // background / subagent 相当はスキップ
  if (payload.is_background_agent === true) {
    return respond({});
  }

  const root = workspaceRoot(payload);
  const id = conversationId(payload);
  onSessionStart(root);
  const stateFileRel = statePathRelative(root, id);

  const ctx = buildContext(root, root, id, stateFileRel);
  if (!ctx.trim()) return respond({});
  return respond({ additional_context: ctx });
}

main().catch((error) => {
  // sessionStart は fail-open: 注入失敗でもセッション開始は阻まない
  respond({
    user_message: `[inject-context] ${error instanceof Error ? error.message : String(error)}`,
  });
});

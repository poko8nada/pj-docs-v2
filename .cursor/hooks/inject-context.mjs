#!/usr/bin/env node
/**
 * sessionStart でプロジェクト context を additional_context として注入する。
 * 対象: AGENTS.md / Product / Issues / Cursor 特有（shell・web）/ Gate rules + Current values /
 *        discussion/SKILL.md（初期相の行動指針・末尾・動的読み込み）
 * 詳細手順は各 skill へ。state ファイルはここでは作らない（TTL 掃除のみ）。作成は初回ユーザー発話（beforeSubmitPrompt）。
 * sticky（last-prompt-id）は更新しない — 書き込みは track の beforeSubmitPrompt のみ。
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { logHookIds } from './lib/id-log.mjs';
import {
  loadState,
  onSessionStart,
  resolveConversationIdFromPayload,
  statePathRelative,
  workspaceRoot,
} from './lib/state.mjs';

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

function readProductState(worktree) {
  const issues = ghJson(worktree, [
    'issue',
    'list',
    '--state',
    'open',
    '--json',
    'number,title,body',
    '--limit',
    '20',
  ]);
  if (!Array.isArray(issues)) {
    return 'No open Goal / Discover / Build issues yet. Orient from discussion; create them in `/work` via `issue` when ready.';
  }
  const pick = (prefix) =>
    issues.find((i) => typeof i.title === 'string' && i.title.startsWith(prefix));
  const goal = pick('[Goal]');
  const discover = pick('[Discover]');
  const build = pick('[Build]');
  if (!goal && !discover && !build) {
    return 'No open Goal / Discover / Build issues yet. Orient from discussion; create them in `/work` via `issue` when ready.';
  }
  const blocks = [];
  for (const issue of [goal, discover, build]) {
    if (!issue) continue;
    blocks.push(`### ${issue.title}\n\n${sanitize(issue.body || '')}`);
  }
  return blocks.join('\n\n');
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

/** Cursor 特有: ワークスペース root 固定 + Shell のまとめ方 */
function readShell() {
  return [
    'Shell cwd is workspace root. Do not `cd` to root or `git -C <workspace-root>`. Subdir `cd` is fine.',
    'Prefer one logical action per Shell call. Related pipes or short chains for one job are fine; do not bundle unrelated steps into one command — use separate Shell calls (parallel when independent).',
  ].join('\n');
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
    'Phase: default `discussion`. Hands-on after user `/work` or `/chore`. Session focus → Read `scope/SKILL.md` (`unlock.scope`; `/discussion` closes). `/work` product edits → Read `agenda/SKILL.md` (`unlock.agenda`; chore keeps null). Edit → Read `rules/SKILL.md` (`unlock.rules`). Issue writes only in `/work`: Read `issue/SKILL.md` + matching Goal/Discover/Build template (`unlock.issue`; template in `read.refs` as `issue/<template>.md`). Phase re-entry clears `read.skills` / `read.refs` (`unlock.scope` stays open until `/discussion`). Broken → user `/bootstrap` only.',
    'Mentor: `/mentor` (human-centered; code edits denied). `/stub` unlocks code for that one turn only while mentor is on — no-op if mentor is off. `/mentor off` leaves mentor. Does not change phase.',
    'References: before gated edits, Read at least one `rules/references/*.md` (tracked in `read.refs` as `rules/<name>.md`). Any `.cursor/skills/*/references/*.md` Read is recorded as `skill/name.md`. Do not edit state files.',
    'Review: `review.files` non-empty → commit blocked; `/pre-commit-reviewer` clears. Persists across phase changes. `md` / `json` / `yaml` are not tracked.',
  ].join('\n');
}

function readGateState(root, id, stateFileRel) {
  const state = loadState(root, id);
  const review = state.review ?? { files: [] };
  const check = state.check ?? { pending: [] };
  const unlock = state.unlock ?? {};
  const read = state.read ?? { skills: [], refs: [] };
  return [
    `Gate state (hooks-only; do not edit): \`${stateFileRel}\``,
    'Name: `YYYYMMDD-HHmmss+0900__<conversation_id>.json`. `unlock.scope`: Read `scope/SKILL.md` → true; `/discussion` → false (survives `/work`|/chore`). `unlock.agenda`: work only — Read `agenda/SKILL.md` → true; discussion/chore → `null`. `unlock.rules`: `null` in discussion; `false` = handshake pending; `true` = unlocked. `/work` `unlock.issue`: `false` until issue-skill Read when writing issues; then template via `read.refs`. `read.skills` = Read of `.cursor/skills/*/SKILL.md`; `read.refs` = `skill/name.md` (both cleared on phase re-entry). `mentor`: explicit `/mentor` / `/mentor off` only.',
    'Set `label` via `node .cursor/skills/scope/scripts/set-label.mjs <label>` (see `scope` skill).',
    '',
    'Current values:',
    `phase: ${state.phase}`,
    `mentor: ${state.mentor === true}`,
    `unlock.scope: ${unlock.scope === true}`,
    `unlock.agenda: ${unlock.agenda}`,
    `unlock.issue: ${unlock.issue}`,
    `unlock.rules: ${unlock.rules}`,
    `read.skills: ${JSON.stringify(read.skills ?? [])}`,
    `read.refs: ${JSON.stringify(read.refs ?? [])}`,
    `label: ${state.label ? state.label : '(none)'}`,
    `review.files: ${JSON.stringify(review.files ?? [])}`,
    `check.pending: ${JSON.stringify(check.pending ?? [])}`,
  ].join('\n');
}

/** 初期相の行動指針。sessionStart のみ（途中の /discussion は skill トリガーで足りる） */
function readDiscussionSkill(worktree) {
  return readIfExists(join(worktree, '.cursor/skills/discussion/SKILL.md'));
}

/** SECTION_DEFS が injected context の唯一の source of truth */
function buildSectionDefs(root, id, stateFileRel) {
  return [
    { id: 'agents', title: 'AGENTS.md', level: 1, codeblock: true, source: readAgents },
    { id: 'product', title: 'Product state', level: 1, source: readProductState },
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
    {
      id: 'discussion',
      title: 'discussion (default phase)',
      level: 1,
      codeblock: true,
      source: readDiscussionSkill,
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
  logHookIds(payload, 'inject-context');

  // background / subagent 相当はスキップ
  if (payload.is_background_agent === true) {
    return respond({});
  }

  const root = workspaceRoot(payload);
  // inject は sessionStart 専用。context 用 id は常に payload（前会話 sticky を見ない）。
  // sticky の更新はユーザー発話（track beforeSubmitPrompt）のみ — Task/subagent の sessionStart で盗ませない。
  const id = resolveConversationIdFromPayload(payload).id;
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

#!/usr/bin/env node
/**
 * sessionStart でプロジェクト context を additional_context として注入する。
 * 対象: AGENTS.md / Spec / Open issues / prior / phase・gate state（短文）
 * state ファイルはここでは作らない（TTL 掃除のみ）。作成は初回ユーザー発話（beforeSubmitPrompt）。
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  conversationId,
  GATE_CONVERSATION_ENV,
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

/** 前フェーズ issue 本文は注入しない — 読む指示のみ */
function readPrior() {
  return [
    'Before acting on a phase, treat prior-phase GitHub issues as source of truth.',
    'Read Spec (and Design / Forge / Refine as relevant) yourself — bodies are not auto-injected here.',
  ].join('\n');
}

function readPhase() {
  return [
    'Default phase is `discussion` (first user prompt). How-to: `.cursor/skills/discussion/SKILL.md`. User may invoke `/discussion` to return from a work phase.',
    'Work phases start only when the user explicitly invokes `/spec`, `/design`, `/forge`, `/refine`, or `/chore`. That unlocks full gh/git (issue writes, commits, etc.).',
    'Do not self-invoke phase skills or treat a work phase as active without that invocation.',
    'Code edits require a work phase first, then Read of `.cursor/skills/implement/SKILL.md` (`implement: true`). In `discussion`, `implement` is `null` — not applicable.',
    'If the gate is broken, the user may invoke `/bootstrap` (emergency bypass) — do not self-invoke. How-to: `.cursor/skills/bootstrap/SKILL.md`.',
    'Phase how-to lives in each phase skill — not here.',
  ].join('\n');
}

function readShell() {
  return [
    'Shell cwd is always the workspace root at session start.',
    'Do not prefix commands with `cd` to the workspace root or `git -C <workspace-root>`.',
    'Run commands directly (`git add …`, `pnpm test`). `cd` into subdirectories is fine (`cd utils && …`).',
  ].join('\n');
}

function readReview() {
  return [
    'After editing product/test sources, harness sets `review.required` until `/pre-commit-reviewer` is invoked once.',
    '`git commit` is blocked while `review.required && !review.done` (agent shell only — lefthook covers human paths).',
    'Before commit: `notes` Commit check → `/pre-commit-reviewer` → read output → fix GAPS if any → `git commit`.',
    'Reviewer is readonly — harness does not re-review after GAPS; main agent fixes then commits.',
    'Successful `git commit` (or an allowed commit attempt) resets `review` to idle (`required: false`).',
  ].join('\n');
}

function readGateState(stateFileRel) {
  return [
    `Your gate state (read-only for you; hooks write it): \`${stateFileRel}\``,
    'Created on the first user prompt as `discussion` (not at CLI startup). Work phases update the same file.',
    'Filename: `YYYYMMDD-HHmmss+0900__<conversation_id>.json` (JST). Fields: `phase`, `implement`, `review`, `updatedAt` (JST `+09:00`).',
    '`implement`: `null` in `discussion` (N/A); `false` = work phase, handshake pending; `true` = code edits allowed.',
    '`review`: `required` + `done` — commit blocked when `required && !done`. `done` is set when `/pre-commit-reviewer` Task is invoked.',
    'If the glob has no match yet, no prompt has been sent in this conversation. Never edit state files.',
    'State survives CLI resume for the same conversation_id; stale files older than 7 days are purged on sessionStart.',
  ].join('\n');
}

/** SECTION_DEFS が injected context の唯一の source of truth */
function buildSectionDefs(stateFileRel) {
  return [
    { id: 'agents', title: 'AGENTS.md', level: 1, codeblock: true, source: readAgents },
    { id: 'spec', title: 'Product Design', level: 1, source: readSpec },
    { id: 'issues', title: 'Open GitHub Issues', level: 2, codeblock: true, source: readIssues },
    { id: 'prior', title: 'Prior phases', level: 2, source: readPrior },
    { id: 'phase', title: 'Phase entry rules', level: 2, source: readPhase },
    { id: 'shell', title: 'Shell cwd', level: 2, source: readShell },
    { id: 'review', title: 'Pre-commit review', level: 2, source: readReview },
    {
      id: 'gate',
      title: 'Gate state',
      level: 2,
      source: () => readGateState(stateFileRel),
    },
  ];
}

function renderSection(section) {
  const heading = '#'.repeat(section.level) + ' ' + section.title;
  const body = section.codeblock ? '```text\n' + section.body + '\n```' : section.body;
  return `${heading}\n\n${body}`;
}

function buildContext(worktree, stateFileRel) {
  const rendered = [];
  for (const def of buildSectionDefs(stateFileRel)) {
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

  const ctx = buildContext(root, stateFileRel);
  const out = {};
  // 公式 sessionStart env — 後続 hook で conversation_id が欠ける場合の正規の伝播手段
  if (id && id !== 'unknown') {
    out.env = { [GATE_CONVERSATION_ENV]: id };
  }
  if (ctx.trim()) out.additional_context = ctx;
  if (Object.keys(out).length === 0) return respond({});

  return respond(out);
}

main().catch((error) => {
  // sessionStart は fail-open: 注入失敗でもセッション開始は阻まない
  respond({
    user_message: `[inject-context] ${error instanceof Error ? error.message : String(error)}`,
  });
});

#!/usr/bin/env node
/**
 * sessionStart でプロジェクト context を additional_context として注入する。
 * 対象: AGENTS.md / Spec / Open issues / prior・phase 入場ルール（短文）
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// null = 無制限 / 数値 = 文字数で機械カット
const MAX_CONTEXT_CHARS = 16000;

const hooksDir = fileURLToPath(new URL('.', import.meta.url));
const projectRootFallback = resolve(hooksDir, '../..');

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

function workspaceRoot(payload) {
  const roots = payload.workspace_roots;
  if (Array.isArray(roots) && roots[0]) return resolve(roots[0]);
  if (payload.cwd) return resolve(payload.cwd);
  return projectRootFallback;
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
    'Phase changes only when the user explicitly invokes `/spec`, `/design`, `/forge`, `/refine`, or `/chore`.',
    'Do not self-invoke phase skills or assume a phase is active without that invocation.',
    'With no phase: discuss, research, edit root-level md, use gh/git — no product/harness code edits.',
    'Code edits require an active phase AND having Read `.cursor/skills/implement/SKILL.md` first, then follow the `implement` skill.',
  ].join('\n');
}

/** SECTION_DEFS が injected context の唯一の source of truth */
const SECTION_DEFS = [
  { id: 'agents', title: 'AGENTS.md', level: 1, codeblock: true, source: readAgents },
  { id: 'spec', title: 'Product Design', level: 1, source: readSpec },
  { id: 'issues', title: 'Open GitHub Issues', level: 2, codeblock: true, source: readIssues },
  { id: 'prior', title: 'Prior phases', level: 2, source: readPrior },
  { id: 'phase', title: 'Phase entry rules', level: 2, source: readPhase },
];

function renderSection(section) {
  const heading = '#'.repeat(section.level) + ' ' + section.title;
  const body = section.codeblock ? '```text\n' + section.body + '\n```' : section.body;
  return `${heading}\n\n${body}`;
}

function buildContext(worktree) {
  const rendered = [];
  for (const def of SECTION_DEFS) {
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
  const ctx = buildContext(root);
  if (!ctx.trim()) return respond({});

  return respond({ additional_context: ctx });
}

main().catch((error) => {
  // sessionStart は fail-open: 注入失敗でもセッション開始は阻まない
  respond({
    user_message: `[inject-context] ${error instanceof Error ? error.message : String(error)}`,
  });
});

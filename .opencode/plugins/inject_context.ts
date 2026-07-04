// @ts-nocheck
import type { Plugin } from '@opencode-ai/plugin';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { execFileSync } from 'child_process';

const MAX_CONTEXT_CHARS = 4000;
const MAX_LINE_LENGTH = 120;

// グローバル opencode 配下の memory Layer 2 を直接参照
// $XDG_CONFIG_HOME を優先、未設定なら ~/.config にフォールバック
const LAYER_2_PATH = path.join(
  process.env.XDG_CONFIG_HOME ?? path.join(os.homedir(), '.config'),
  'opencode',
  'skills',
  'memory',
  'store',
  'layer-2.md',
);

// ── helpers ───────────────────────────────────────────────────────────────────

function truncateLine(line: string, max = MAX_LINE_LENGTH): string {
  return line.length > max ? line.slice(0, max) + '…' : line;
}

function sanitize(text: string): string {
  return text
    .replace(/\r/g, '')
    .replace(/\t/g, ' ')
    .split('\n')
    .map((l) => truncateLine(l))
    .join('\n');
}

function readIfExists(filePath: string, max = 500): string {
  if (!fs.existsSync(filePath)) return '';
  try {
    return sanitize(fs.readFileSync(filePath, 'utf-8').slice(0, max));
  } catch {
    return '';
  }
}

// ── GitHub issues ─────────────────────────────────────────────────────────────

function readGithubIssues(worktree: string): string {
  try {
    const stdout = execFileSync(
      'gh',
      ['issue', 'list', '--state', 'open', '--json', 'number,title,labels', '--limit', '5'],
      { cwd: worktree, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] },
    );
    const issues = JSON.parse(stdout);
    if (!Array.isArray(issues) || issues.length === 0) return '';
    return sanitize(
      issues
        .map((i: unknown) => {
          const labels =
            i.labels?.length > 0 ? ` [${i.labels.map((l: unknown) => l.name).join(', ')}]` : '';
          return `- #${i.number} ${i.title}${labels}`;
        })
        .join('\n'),
    );
  } catch {
    return '';
  }
}

function readSpecIssue(worktree: string): { title: string; body: string } | null {
  try {
    const stdout = execFileSync(
      'gh',
      ['issue', 'list', '--state', 'open', '--json', 'number,title,body', '--limit', '10'],
      { cwd: worktree, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] },
    );
    const issues = JSON.parse(stdout);
    if (!Array.isArray(issues)) return null;

    // Find issue with [Spec] prefix in title
    const spec = issues.find(
      (i: unknown) => typeof i.title === 'string' && i.title.startsWith('[Spec]'),
    );
    if (!spec) return null;

    return {
      title: spec.title,
      body: sanitize(spec.body || ''),
    };
  } catch {
    return '';
  }
}

// ── context builders ──────────────────────────────────────────────────────────

const FLOW_DESCRIPTIONS = [
  '## Project protocol',
  '',
  `The project is driven by design → build → refine as one loop.
  - Design is based on the spec issue.
  - Build is based on the design.
  - Refine is performed based on the build.`,
  '',
  `Project phases and states are managed by issues. Especially, "spec" issue is a definition of a project.
  Here is the definition of each phase.

  | phase  | overview                                           |
  | ------ | -------------------------------------------------- |
  | design | Agree on design / project direction                |
  | build  | Implement product                                  |
  | refine | Refactor / polish product                          |
  | chore  | meta / minor modify / others (harness, typo, etc.) |`,
  '',
  '## Session Flow',
  '',
  `Every session starts in **open-discussion.** You CANNOT execute tools (edit, write, bash).
  Your role is to DISCUSS, RESEARCH, and PROPOSE — not to implement.

  To execute tools, ALL of these conditions must be met:
    1. Phase set via [setup] (design, build, refine, or chore)
    2. Required skills loaded IN ORDER — do not skip:
       design/build/refine → feasibility → prepare → execution skill
       chore → execution skill
    3. User says GO
    GO alone is NOT enough. Skills must be loaded first.

  Phase-specific behavior:
    open_discussion — DISCUSS only. Propose approaches. Ask questions. Do NOT write code.
    design — RESEARCH best practices. Use feasibility skill. Do NOT implement.
    build — PLAN then IMPLEMENT. Use prepare → implement skills.
    refine — ANALYZE then IMPROVE. Use prepare → implement skills.
    chore — EXECUTE directly. Minor changes, harness, typos only.

  The agent proposes next steps. The user controls flow with trigger words (GO, RESET, STATE).`,
].join('\n');

function buildAgentsContext(worktree: string): string {
  return readIfExists(path.join(worktree, 'AGENTS.md'), 4000);
}

function buildLayer2Context(_worktree: string): string {
  return readIfExists(LAYER_2_PATH, 2000);
}

function buildSpecContext(worktree: string): string {
  const spec = readSpecIssue(worktree);
  if (spec) {
    return ['## Spec', '', `### ${spec.title}`, '', spec.body].join('\n');
  }

  // No spec found — suggest checking for project documents
  return [
    '## No spec Found',
    '',
    'No spec issue exists yet. Check if there are planning documents in the project',
    '(e.g., README.md, docs/). If so, review them and consider creating a spec',
    'issue to track the product design.',
  ].join('\n');
}

function buildProjectContext(worktree: string): string {
  const sections: string[] = [];

  const issues = readGithubIssues(worktree);
  if (issues) sections.push(['## Open GitHub Issues', '', '```text', issues, '```'].join('\n'));

  return sections.join('\n\n---\n\n');
}

async function buildContext(worktree: string): Promise<string> {
  const sections: string[] = [];

  // 1. AGENTS.md — how to behave
  const agents = buildAgentsContext(worktree);
  if (agents) sections.push(['# AGENTS.md', '', '```text', agents, '```'].join('\n'));

  // 2. Layer 2 — what to know (memory principles)
  const layer2 = buildLayer2Context(worktree);
  if (layer2) sections.push(['# Memory Principles', '', '```text', layer2, '```'].join('\n'));

  // 3. Spec — product design
  const spec = buildSpecContext(worktree);
  if (spec) sections.push(['# Product Design', '', spec].join('\n'));

  // 4. Project Context — current state
  const project = buildProjectContext(worktree);
  if (project) sections.push(['# Project Context', '', project].join('\n'));

  // 5. Flow descriptions — new model (Open discussion + types)
  sections.push(FLOW_DESCRIPTIONS);

  return sections.join('\n\n---\n\n').slice(0, MAX_CONTEXT_CHARS);
}

// ── plugin ────────────────────────────────────────────────────────────────────

// chat.message hook は廃止。inject status の user-visible 表示は不安定 (opencode #885 / #23440)。
// system.transform 経由での LLM 注入のみ残す (agent は context を受け取るが、user chat には出ない)。
export const InjectContextPlugin: Plugin = async ({ worktree }) => {
  const contextCache = new Map<string, Promise<string>>();

  return {
    event: async ({ event }) => {
      if (event.type === 'session.created') {
        const info = event.properties.info;
        if (info.parentID) return; // skip subagent
        contextCache.set(info.id, buildContext(worktree));
      }
      if (event.type === 'session.compacted') {
        const { sessionID } = event.properties;
        contextCache.set(sessionID, buildContext(worktree));
      }
    },

    'experimental.chat.system.transform': async (input, output) => {
      const { sessionID } = input;
      if (!sessionID) return;

      const ctxPromise = contextCache.get(sessionID);
      if (!ctxPromise) return;

      const ctx = await ctxPromise;
      if (!ctx?.trim()) return;

      output.system.push(ctx);
    },
  };
};

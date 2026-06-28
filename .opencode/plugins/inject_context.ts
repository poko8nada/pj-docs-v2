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

const LEVEL_DESCRIPTIONS = [
  '## Execution Gate Levels',
  '',
  '| Level | Name    | Research             | Plan     | Trigger  |',
  '|-------|---------|----------------------|----------|----------|',
  '| LV1   | Light   | 0                    | -        | required |',
  '| LV2   | Default | 1 call               | required | required |',
  '| LV3   | Plan    | 2 calls + discussion | required | required |',
  '',
  '- **Default**: Session starts at **LV2**. Do not assume LV1.',
  '- **Authority**: Level changes (`l<N>` / `LV<N>` / trigger words) are user-only. Agents cannot change levels.',
  '  - Correct flow: `setup` skill → research → plan → ask user for `GO` → reload triggers needed for implementation/updates',
  '  - User trigger words. Execute: `GO` (start), `DONE` (complete), `STATE` (show state)',
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

  // No Spec found — suggest checking for project documents
  return [
    '## No Spec Found',
    '',
    'No Spec issue exists yet. Check if there are planning documents in the project',
    '(e.g., README.md, docs/). If so, review them and consider creating a Spec',
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
  if (layer2)
    sections.push(['# Memory Principles (Layer 2)', '', '```text', layer2, '```'].join('\n'));

  // 3. Spec — product design
  const spec = buildSpecContext(worktree);
  if (spec) sections.push(['# Product Design', '', spec].join('\n'));

  // 4. Project Context — current state
  const project = buildProjectContext(worktree);
  if (project) sections.push(['# Project Context', '', project].join('\n'));

  // 5. Execution Gate Levels — level descriptions
  sections.push(LEVEL_DESCRIPTIONS);

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

// @ts-nocheck
import type { Plugin } from '@opencode-ai/plugin';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { execFileSync } from 'child_process';

const MAX_CONTEXT_CHARS = 4000;
const MAX_LINE_LENGTH = 120;

const IGNORE_DIRS = new Set([
  'node_modules',
  '.git',
  '.opencode',
  'dist',
  'build',
  '.next',
  'coverage',
]);

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

function fileSize(filePath: string): number {
  if (!fs.existsSync(filePath)) return 0;
  try {
    return fs.readFileSync(filePath, 'utf-8').length;
  } catch {
    return 0;
  }
}

function buildFlatTree(dir: string): string {
  try {
    const entries = fs
      .readdirSync(dir, { withFileTypes: true })
      .filter((e) => !IGNORE_DIRS.has(e.name))
      .toSorted((a, b) => a.name.localeCompare(b.name));
    return entries
      .map((entry) => (entry.isDirectory() ? `📁 ${entry.name}/` : `📄 ${entry.name}`))
      .join('\n');
  } catch {
    return '';
  }
}

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

function hasGithubIssues(worktree: string): boolean {
  try {
    const stdout = execFileSync(
      'gh',
      ['issue', 'list', '--state', 'open', '--json', 'number', '--limit', '1'],
      { cwd: worktree, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] },
    );
    const issues = JSON.parse(stdout);
    return Array.isArray(issues) && issues.length > 0;
  } catch {
    return false;
  }
}

// ── inject status ─────────────────────────────────────────────────────────────

type InjectStatus = {
  agents: { ok: boolean; size: number };
  layer2: { ok: boolean; size: number };
  issues: { ok: boolean; count: number };
  readme: { ok: boolean; size: number };
  tree: { ok: boolean; size: number };
};

function buildInjectStatus(worktree: string): InjectStatus {
  const agentsPath = path.join(worktree, 'AGENTS.md');
  const layer2Path = LAYER_2_PATH;
  const readmePath = path.join(worktree, 'README.md');

  return {
    agents: { ok: fileSize(agentsPath) > 0, size: fileSize(agentsPath) },
    layer2: { ok: fileSize(layer2Path) > 0, size: fileSize(layer2Path) },
    issues: { ok: hasGithubIssues(worktree), count: hasGithubIssues(worktree) ? 1 : 0 },
    readme: { ok: fileSize(readmePath) > 0, size: fileSize(readmePath) },
    tree: { ok: buildFlatTree(worktree).length > 0, size: buildFlatTree(worktree).length },
  };
}

function formatStatusField(s: { ok: boolean; size?: number; count?: number }): string {
  return s.ok ? `✓ ${s.size ?? s.count} chars` : '✗ not found';
}

function formatInjectStatus(status: InjectStatus): string {
  return [
    '[Inject Status]',
    `- AGENTS.md: ${formatStatusField(status.agents)}`,
    `- Memory Layer 2: ${formatStatusField(status.layer2)}`,
    `- GitHub Issues: ${status.issues.ok ? `✓ ${status.issues.count}+` : '✗ none'}`,
    `- README.md: ${formatStatusField(status.readme)}`,
    `- Project Tree: ${formatStatusField(status.tree)}`,
  ].join('\n');
}

// ── context builders ──────────────────────────────────────────────────────────

function buildAgentsContext(worktree: string): string {
  return readIfExists(path.join(worktree, 'AGENTS.md'), 4000);
}

function buildLayer2Context(_worktree: string): string {
  return readIfExists(LAYER_2_PATH, 2000);
}

function buildProjectContext(worktree: string): string {
  const sections: string[] = [];

  const issues = readGithubIssues(worktree);
  if (issues) sections.push(['## Open GitHub Issues', '', '```text', issues, '```'].join('\n'));

  const readme = readIfExists(path.join(worktree, 'README.md'), 500);
  if (readme) sections.push(['## README', '', '```text', readme, '```'].join('\n'));

  const tree = buildFlatTree(worktree);
  if (tree) sections.push(['## Project Structure', '', '```text', tree, '```'].join('\n'));

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

  // 3. Project Context — current state
  const project = buildProjectContext(worktree);
  if (project) sections.push(['# Project Context', '', project].join('\n'));

  return sections.join('\n\n---\n\n').slice(0, MAX_CONTEXT_CHARS);
}

// ── plugin ────────────────────────────────────────────────────────────────────

export const InjectContextPlugin: Plugin = async ({ worktree }) => {
  const contextCache = new Map<string, Promise<string>>();
  // Sessions that should receive a one-time Inject Status display.
  const pendingStatus = new Set<string>();

  const enqueueStatus = (sessionID: string) => {
    if (sessionID) pendingStatus.add(sessionID);
  };

  return {
    event: async ({ event }) => {
      if (event.type === 'session.created') {
        const info = event.properties.info;
        if (info.parentID) return; // skip subagent
        contextCache.set(info.id, buildContext(worktree));
        enqueueStatus(info.id);
      }
      if (event.type === 'session.compacted') {
        const { sessionID } = event.properties;
        contextCache.set(sessionID, buildContext(worktree));
        enqueueStatus(sessionID);
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

    'chat.message': async (input, output) => {
      const sessionID = input.sessionID;
      if (!sessionID) return;
      if (!pendingStatus.has(sessionID)) return;
      pendingStatus.delete(sessionID);

      const status = buildInjectStatus(worktree);
      const text = formatInjectStatus(status);

      const firstPart = output.parts.find((p) => p.type === 'text');
      if (!firstPart || firstPart.type !== 'text') return;

      const messageID = output.message.id;
      if (!messageID) return;

      output.parts.unshift({
        type: 'text',
        id: `prt_${crypto.randomUUID()}`,
        sessionID,
        messageID,
        text,
      });
    },
  };
};

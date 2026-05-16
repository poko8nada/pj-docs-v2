// @ts-nocheck
import type { Plugin } from '@opencode-ai/plugin';
import * as fs from 'fs';
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

function readReadme(worktree: string): string {
  for (const name of ['README.md', 'readme.md', 'README.mdx']) {
    const file = path.join(worktree, name);
    if (!fs.existsSync(file)) continue;
    try {
      return sanitize(fs.readFileSync(file, 'utf-8').slice(0, 500));
    } catch {
      return '';
    }
  }
  return '';
}

function readPackageJson(worktree: string): string {
  const file = path.join(worktree, 'package.json');
  if (!fs.existsSync(file)) return '';
  try {
    const pkg = JSON.parse(fs.readFileSync(file, 'utf-8'));
    return sanitize(
      JSON.stringify(
        {
          name: pkg.name,
          version: pkg.version,
          private: pkg.private,
          scripts: pkg.scripts ? Object.keys(pkg.scripts) : [],
          dependencies: pkg.dependencies ? Object.keys(pkg.dependencies).slice(0, 20) : [],
          devDependencies: pkg.devDependencies ? Object.keys(pkg.devDependencies).slice(0, 20) : [],
        },
        null,
        2,
      ),
    );
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

function readProjectMeta(worktree: string): string {
  const metaPath = path.join(worktree, '.opencode', 'rules', 'project-meta.mdc');
  if (!fs.existsSync(metaPath)) return '';
  try {
    return sanitize(fs.readFileSync(metaPath, 'utf-8').trim());
  } catch {
    return '';
  }
}

async function buildContext(worktree: string): Promise<string> {
  const sections: string[] = [];

  const meta = readProjectMeta(worktree);
  if (meta) sections.push(['## Project Guidelines', '', meta].join('\n'));

  const issues = readGithubIssues(worktree);
  if (issues) sections.push(['## Open GitHub Issues', '', '```text', issues, '```'].join('\n'));

  const readme = readReadme(worktree);
  if (readme) sections.push(['## README', '', '```text', readme, '```'].join('\n'));

  const pkg = readPackageJson(worktree);
  if (pkg) sections.push(['## package.json', '', '```json', pkg, '```'].join('\n'));

  const tree = buildFlatTree(worktree);
  if (tree) sections.push(['## Project Structure', '', '```text', tree, '```'].join('\n'));

  return sections.join('\n\n---\n\n').slice(0, MAX_CONTEXT_CHARS);
}

// ── plugin ────────────────────────────────────────────────────────────────────

export const InjectContextPlugin: Plugin = async ({ worktree }) => {
  const contextCache = new Map<string, Promise<string>>();

  return {
    event: async ({ event }) => {
      if (event.type === 'session.created') {
        const info = event.properties.info;
        if (info.parentID) return;
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

      output.system.push(['# Project Context', '', ctx].join('\n'));
    },
  };
};

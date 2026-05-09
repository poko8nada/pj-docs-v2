import type { Plugin } from '@opencode-ai/plugin';
import * as fs from 'fs';
import * as path from 'path';

const MAX_FILE_LINES = 40;
const MAX_TREE_DEPTH = 3;

const IGNORE_DIRS = new Set([
  'node_modules',
  '.git',
  '.opencode',
  'dist',
  'build',
  '.next',
  'coverage',
]);

// ── file tree ────────────────────────────────────────────────────────────────

function readFileHead(filePath: string, maxLines: number): string {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n').slice(0, maxLines);
    return lines.join('\n');
  } catch {
    return '';
  }
}

function buildTree(dir: string, depth: number, maxDepth: number): string {
  if (depth > maxDepth) return '';

  let result = '';
  let entries: fs.Dirent[];

  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return '';
  }

  for (const entry of entries) {
    if (IGNORE_DIRS.has(entry.name)) continue;

    const indent = '  '.repeat(depth);
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      result += `${indent}📁 ${entry.name}/\n`;
      result += buildTree(fullPath, depth + 1, maxDepth);
    } else {
      result += `${indent}📄 ${entry.name}\n`;
      const head = readFileHead(fullPath, MAX_FILE_LINES);
      if (head) {
        const headLines = head
          .split('\n')
          .map((l) => `${indent}  | ${l}`)
          .join('\n');
        result += `${headLines}\n`;
      }
    }
  }

  return result;
}

// ── context builder ──────────────────────────────────────────────────────────

async function buildContext(worktree: string, $: unknown): Promise<string> {
  const sections: string[] = [];

  // 1. GitHub open issues
  try {
    // @ts-ignore
    const result = await $`gh issue list --state open --json number,title,body,labels --limit 10`;
    const issues = JSON.parse(result.stdout);
    if (issues.length > 0) {
      const formatted = issues
        .map(
          (i: unknown) =>
            // @ts-ignore
            `### #${i.number} ${i.title}\n` +
            // @ts-ignore
            (i.labels?.length
              ? // @ts-ignore
                `Labels: ${i.labels.map((l: unknown) => l.name).join(', ')}\n`
              : '') +
            // @ts-ignore
            (i.body ? `${i.body.slice(0, 500)}\n` : ''),
        )
        .join('\n---\n');
      sections.push(`## Open GitHub Issues\n\n${formatted}`);
    }
  } catch {
    // gh cli not available or not a gh repo — skip silently
  }

  // 2. project-meta rule
  const projectMetaPath = path.join(worktree, '.opencode', 'rules', 'project-meta.mdc');
  if (fs.existsSync(projectMetaPath)) {
    const content = fs.readFileSync(projectMetaPath, 'utf-8').trim();
    if (content) sections.push(`## Project Meta\n\n${content}`);
  }

  // 4. README
  const readmeCandidates = ['README.md', 'readme.md', 'README.mdx'];
  for (const name of readmeCandidates) {
    const readmePath = path.join(worktree, name);
    if (fs.existsSync(readmePath)) {
      const content = fs.readFileSync(readmePath, 'utf-8').slice(0, 3000);
      sections.push(`## README\n\n${content}`);
      break;
    }
  }

  // 5. Project file tree with file heads
  const tree = buildTree(worktree, 0, MAX_TREE_DEPTH);
  if (tree) {
    sections.push(
      `## Project Structure (depth: ${MAX_TREE_DEPTH}, first ${MAX_FILE_LINES} lines per file)\n\n${tree}`,
    );
  }

  return sections.join('\n\n---\n\n');
}

// ── plugin ───────────────────────────────────────────────────────────────────

export const InjectContextPlugin: Plugin = async ({ worktree, $ }) => {
  // sessionID → context string
  const contextCache = new Map<string, string>();

  return {
    event: async ({ event }) => {
      if (event.type === 'session.created') {
        const sessionID = event.properties.info.id;
        // Fetch in background; store when ready
        buildContext(worktree, $).then((ctx) => {
          contextCache.set(sessionID, ctx);
        });
      }
      if (event.type === 'session.compacted') {
        const sessionID = event.properties.sessionID;
        buildContext(worktree, $).then((ctx) => {
          contextCache.set(sessionID, ctx);
        });
      }
    },

    'experimental.chat.system.transform': async (input, output) => {
      const sessionID = input.sessionID;
      if (!sessionID) return;

      const ctx = contextCache.get(sessionID);
      if (!ctx) return;

      output.system.push(
        `
# Project Context (injected by opencode plugin)

${ctx}
      `.trim(),
      );
    },
  };
};

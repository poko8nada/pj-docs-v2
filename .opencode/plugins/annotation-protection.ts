import type { Plugin } from '@opencode-ai/plugin';
import * as fs from 'fs';
import * as path from 'path';

// UO / AN コメントの削除を防止するプラグイン
// ツール実行前后で UO/AN コメント数をスナップショットし、減少したらエラー

const UO_PATTERN = /UO\[/g;
const AN_PATTERN = /AN\[/g;

// ファイル変更の可能性がないツール (アーリーリターン)
const READONLY_TOOLS = new Set([
  'read',
  'grep',
  'glob',
  'websearch',
  'webfetch',
  'lsp',
  'skill',
  'question',
  'task',
  'todowrite',
]);

const IGNORE_DIRS = new Set(['node_modules', '.git', 'dist']);

// ── bash read-only パターン (execution_gate.ts と同等ロジック) ──
// read-only コマンドは UO スナップショット不要

const GIT_READONLY = /^(diff|log|status|show|remote|tag|stash\s+list|reflog|blame|shortlog)\b/;

const BASH_READONLY =
  /^\s*(grep|rg|find|ls|cat|head|tail|wc|sort|uniq|diff|echo|printf|date|pwd|which|type|file|stat|du|df|env|printenv|history|ps|top|free|uptime|w|who|id|groups)\b/;

const GH_READONLY_VERBS =
  'view|list|status|checks|diff|logs|ports|get|token|download|verify|verify-asset|trusted-root|check|gitignore|license|field-list|item-list';
const GH_READONLY_RESOURCES =
  'issue|pr|release|repo|run|workflow|auth|org|label|alias|attestation|cache|config|codespace|gist|gpg-key|project|ruleset|search|secret|ssh-key|variable';
const GH_READONLY = new RegExp(
  `^\\s*gh\\s+(?:${GH_READONLY_RESOURCES})\\s+(?:${GH_READONLY_VERBS})\\b`,
);
const GH_SEARCH_READONLY = /^\s*gh\s+search\s+(?:code|commits|issues|prs|repos|users)\b/;
const GH_COMPLETION_READONLY = /^\s*gh\s+completion\s+(?:bash|fish|powershell|zsh)\b/;
const GH_READONLY_STANDALONE =
  /^\s*gh\s+(?:--?help|-h|-v|--?version|help(?:\s+\S+)?|status|browse|completion|licenses|preview)\s*$/;

const BASH_EXTERNAL_CLI = /^\s*(gog|cmux)(\s|$|;|\||&)/;

const isBashReadOnly = (command: string): boolean => {
  const trimmed = command.trimStart();
  return (
    BASH_READONLY.test(trimmed) ||
    (/^git\s+/.test(trimmed) && GIT_READONLY.test(trimmed.replace(/^git\s+/, ''))) ||
    GH_READONLY.test(trimmed) ||
    GH_SEARCH_READONLY.test(trimmed) ||
    GH_COMPLETION_READONLY.test(trimmed) ||
    GH_READONLY_STANDALONE.test(trimmed) ||
    BASH_EXTERNAL_CLI.test(trimmed)
  );
};

// ファイル内の UO/AN コメント数を数える
const countComments = (filePath: string): number => {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const uoCount = content.match(UO_PATTERN)?.length ?? 0;
    const anCount = content.match(AN_PATTERN)?.length ?? 0;
    return uoCount + anCount;
  } catch {
    return 0;
  }
};

// プロジェクト内の全ファイルを走査して UO/AN コメントを含むファイルを検出
const findAnnotatedFiles = (rootDir: string): Map<string, number> => {
  const counts = new Map<string, number>();

  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (IGNORE_DIRS.has(entry.name)) continue;
        walk(path.join(dir, entry.name));
      } else {
        const filePath = path.join(dir, entry.name);
        const count = countComments(filePath);
        if (count > 0) counts.set(filePath, count);
      }
    }
  };

  walk(rootDir);
  return counts;
};

// スナップショット: { ファイルパス → UO コメント数 }
let snapshot: Map<string, number> | null = null;

export const AnnotationProtectionPlugin: Plugin = async ({ worktree }) => {
  return {
    'tool.execute.before': async (input, output) => {
      if (READONLY_TOOLS.has(input.tool)) return;

      const filePath = (output.args as { filePath?: string } | undefined)?.filePath;

      if (filePath) {
        snapshot = new Map([[filePath, countComments(filePath)]]);
      } else if (input.tool === 'bash') {
        const command = String((output.args as { command?: string } | undefined)?.command ?? '');
        if (isBashReadOnly(command)) return;
        snapshot = findAnnotatedFiles(worktree);
      }
    },

    'tool.execute.after': async (input, _output) => {
      if (!snapshot) return;

      const violations: string[] = [];

      if (input.tool === 'bash') {
        for (const [file, before] of snapshot) {
          const after = countComments(file);
          if (after < before) {
            violations.push(`  - ${file}: ${before} → ${after}`);
          }
        }
      } else {
        const filePath = (input.args as { filePath?: string } | undefined)?.filePath;
        if (filePath && snapshot.has(filePath)) {
          const before = snapshot.get(filePath)!;
          const after = countComments(filePath);
          if (after < before) {
            violations.push(`  - ${filePath}: ${before} → ${after}`);
          }
        }
      }

      snapshot = null;

      if (violations.length > 0) {
        throw new Error(
          [
            '🚫 UO/AN comments were removed during implementation. Restore them before proceeding.',
            '',
            'Affected files:',
            ...violations,
            '',
            'UO/AN comments must remain untouched. Only mark as [done] — do not delete.',
          ].join('\n'),
        );
      }
    },
  };
};

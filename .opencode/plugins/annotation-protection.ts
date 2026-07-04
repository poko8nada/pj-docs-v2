import type { Plugin } from '@opencode-ai/plugin';
import * as fs from 'fs';
import * as path from 'path';

// UO / AN コメントの削除を防止するプラグイン
// ツール実行前后で注釈行をスナップショットし、欠落したらエラー

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

// ファイル内の UO/AN コメント行を抽出
export function extractAnnotations(filePath: string): string[] {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return content
      .split('\n')
      .filter((line) => /UO\[/.test(line) || /AN\[/.test(line))
      .map((line) => line.trim());
  } catch {
    return [];
  }
}

// スナップショット: { ファイルパス → 注釈行の配列 }
let snapshot: Map<string, string[]> | null = null;

export const AnnotationProtectionPlugin: Plugin = async ({ worktree }) => {
  return {
    'tool.execute.before': async (input, output) => {
      if (READONLY_TOOLS.has(input.tool)) return;

      const filePath = (output.args as { filePath?: string } | undefined)?.filePath;

      if (filePath) {
        const annotations = extractAnnotations(filePath);
        if (annotations.length > 0) {
          snapshot = new Map([[filePath, annotations]]);
        }
      } else if (input.tool === 'bash') {
        const command = String((output.args as { command?: string } | undefined)?.command ?? '');
        if (isBashReadOnly(command)) return;
        // bash の場合は全ファイル走査して注釈行を収集
        const allAnnotations = new Map<string, string[]>();
        const walk = (dir: string) => {
          for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            if (entry.isDirectory()) {
              if (IGNORE_DIRS.has(entry.name)) continue;
              walk(path.join(dir, entry.name));
            } else {
              const fp = path.join(dir, entry.name);
              const annotations = extractAnnotations(fp);
              if (annotations.length > 0) allAnnotations.set(fp, annotations);
            }
          }
        };
        walk(worktree);
        if (allAnnotations.size > 0) snapshot = allAnnotations;
      }
    },

    'tool.execute.after': async (_input, _output) => {
      if (!snapshot) return;

      const violations: string[] = [];

      for (const [file, beforeLines] of snapshot) {
        const afterLines = extractAnnotations(file);
        // 旧ファイルにあった各行が新ファイルにも存在するか
        for (const line of beforeLines) {
          if (!afterLines.includes(line)) {
            violations.push(`  - ${file}: removed "${line}"`);
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

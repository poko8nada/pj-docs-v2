import type { Plugin } from '@opencode-ai/plugin';
import { minimatch } from 'minimatch';

const CONFIG_FILE_PATTERNS: string[] = [
  'tsconfig*.json',
  'package.json',
  '{package-lock.json,pnpm-lock.yaml,yarn.lock}',
  'bun.lock*',
  '*.config.*',
  '.oxfmtrc.*',
  '.prettierrc*',
  '.prettierignore',
  '.editorconfig',
  '.oxlintrc.*',
  '.oxlintignore',
  '.eslintrc*',
  '.eslintignore',
  '.gitignore',
  '.gitattributes',
  'lefthook.yaml',
  '.husky/**',
  '{AGENTS,CLAUDE,GEMINI}.md',
  '.cursorrules',
  '.opencode/**',
  '.env*',
  'wrangler.toml',
  'Dockerfile',
  'docker-compose.{yml,yaml}',
  'vercel.json',
  'netlify.toml',
  '.github/workflows/*.{yml,yaml}',
];

function isConfigFile(filePath: string): boolean {
  return CONFIG_FILE_PATTERNS.some((pattern) => minimatch(filePath, pattern));
}

export const EnforceResearchPlugin: Plugin = async () => {
  return {
    'tool.execute.before': async (input, output) => {
      if (!['edit', 'write', 'apply_patch'].includes(input.tool)) return;

      const args = (output?.args ?? {}) as Record<string, unknown>;
      const filePath = String(args.filePath ?? args.path ?? args.file ?? '');
      if (!filePath) return;

      if (isConfigFile(filePath)) {
        throw new Error(
          `[enforce-research] ${filePath} is a config file. Before modifying, research the file format / API surface via Context7 or web search, report findings to the user, then apply.`,
        );
      }
    },
  };
};

import type { Plugin } from '@opencode-ai/plugin';

const ALLOWED_COMMANDS = new Set([
  // Read / search
  'ls',
  'find',
  'cat',
  'head',
  'tail',
  'grep',
  'rg',
  'wc',
  'echo',
  'pwd',
  'which',
  'sleep',
  'pgrep',
  'pkill',
  'curl',
  // Git (subcommands checked separately)
  'git',
  // Runtime / package managers
  'node',
  'bun',
  'npx',
  'pnpm',
  'npm',
  // Build / test
  'tsc',
  'vitest',
  'jest',
  // File operations
  'mkdir',
  'touch',
  'cp',
  'mv',
  // Project-specific
  'oxlint',
  'oxfmt',
  'browser-use',
  'gh',
  'gog',
  // python 3
  'python3',
]);

// git subcommands that are explicitly blocked
const BLOCKED_GIT_SUBCOMMANDS = new Set([
  'push', // covers --force too; allow only explicit safe push if needed
  'reset',
  'clean',
  'rebase',
]);

// Flags that make otherwise-allowed git commands dangerous
const DANGEROUS_GIT_FLAGS = ['--force', '-f', '--hard', '--mirror'];

const parseCommand = (raw: string): string[] => {
  // Minimal tokenizer: split on whitespace, strip quotes
  return raw
    .trim()
    .split(/\s+/)
    .map((t) => t.replace(/^['"]|['"]$/g, ''));
};

const validateGit = (tokens: string[]) => {
  const subcommand = tokens[1];
  if (!subcommand) return; // bare `git` — let it through

  if (BLOCKED_GIT_SUBCOMMANDS.has(subcommand)) {
    throw new Error(`[restrict-commands] git ${subcommand} is not allowed.`);
  }

  const hasFlag = tokens.some((t) => DANGEROUS_GIT_FLAGS.includes(t));
  if (hasFlag) {
    throw new Error(
      `[restrict-commands] Dangerous git flag detected in: git ${tokens.slice(1).join(' ')}`,
    );
  }
};

export const RestrictCommandsPlugin: Plugin = async () => {
  return {
    'tool.execute.before': async (input, output) => {
      if (input.tool !== 'bash') return;

      const command: string = output.args?.command ?? '';
      if (!command) return;

      const tokens = parseCommand(command);
      const bin = tokens[0];

      if (!ALLOWED_COMMANDS.has(bin)) {
        throw new Error(
          `[restrict-commands] "${bin}" is not in the allowed command list. ` +
            `Allowed: ${[...ALLOWED_COMMANDS].join(', ')}`,
        );
      }

      if (bin === 'git') {
        validateGit(tokens);
      }
    },
  };
};

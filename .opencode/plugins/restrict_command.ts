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
  'for',
  'wc',
  'echo',
  'pwd',
  'which',
  'lsof',
  'sleep',
  'pgrep',
  'pkill',
  'curl',
  'sort',
  'mktemp',
  'date',
  // Git (subcommands checked separately)
  'git',
  // Runtime / package managers
  'node',
  'bun',
  'npx',
  'pnpm',
  // Build / test
  'tsc',
  'vitest',
  'jest',
  // File operations
  'mkdir',
  'touch',
  'cp',
  'mv',
  'rm',
  // Project-specific
  'oxlint',
  'oxfmt',
  'browser-use',
  'cmux',
  'gh',
  'gog',
  // python 3
  'python3',
  // image
  'sips',
]);

// git subcommands that are explicitly blocked. Empty for now — dangerous
// subcommands (reset / clean / rebase) are governed by the global `bash`
// permission (`ask` in `~/.config/opencode/opencode.json`).
const BLOCKED_GIT_SUBCOMMANDS: Set<string> = new Set();

// Flags that make otherwise-allowed git commands dangerous
const DANGEROUS_GIT_FLAGS = ['--force', '-f', '--hard', '--mirror'];

const parseCommands = (raw: string): string[][] => {
  const segments: string[] = [];
  let current = '';
  let inSingle = false;
  let inDouble = false;
  let parenDepth = 0; // コマンド置換のネスト対応

  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    const next = raw[i + 1];

    // クォート処理
    if (ch === "'" && !inDouble) {
      inSingle = !inSingle;
      current += ch;
      continue;
    }
    if (ch === '"' && !inSingle) {
      inDouble = !inDouble;
      current += ch;
      continue;
    }

    if (!inSingle && !inDouble) {
      // コマンド置換の深さ管理
      if (ch === '$' && next === '(') {
        parenDepth++;
        current += ch;
        continue;
      }
      if (ch === ')') {
        parenDepth = Math.max(0, parenDepth - 1);
        current += ch;
        continue;
      }

      // コマンド区切り
      if (ch === '&' && next === '&') {
        segments.push(current.trim());
        current = '';
        i++;
        continue;
      }
      if (ch === '|' && next === '|') {
        segments.push(current.trim());
        current = '';
        i++;
        continue;
      }
      if (ch === '|' && next !== '|') {
        segments.push(current.trim());
        current = '';
        continue;
      }
      if (ch === ';') {
        segments.push(current.trim());
        current = '';
        continue;
      }
    }

    current += ch;
  }

  if (current.trim()) segments.push(current.trim());

  return segments
    .filter(Boolean)
    .map((segment) => {
      // 変数代入 + コマンド置換のパターン (VAR=...)
      if (/^[A-Z_][A-Z0-9_]*=/.test(segment)) {
        // $(...) の中身を抽出（改善版）
        const cmdSubMatch = segment.match(/\$\(([\s\S]+?)\)$/); // 最後まで取る
        if (cmdSubMatch) {
          const innerCmd = cmdSubMatch[1].trim();
          return innerCmd.split(/\s+/).map((t) => t.replace(/^['"]|['"]$/g, ''));
        }
        // 単純な値代入は無視
        return [];
      }

      // 通常のコマンド
      return segment.split(/\s+/).map((t) => t.replace(/^['"]|['"]$/g, ''));
    })
    .filter((tokens) => tokens.length > 0);
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

      const commandSets = parseCommands(command);

      for (const tokens of commandSets) {
        const bin = tokens[0];
        if (!bin) continue;

        if (!ALLOWED_COMMANDS.has(bin)) {
          throw new Error(
            `[restrict-commands] "${bin}" is not in the allowed command list. ` +
              `Allowed: ${[...ALLOWED_COMMANDS].join(', ')}`,
          );
        }

        if (bin === 'git') {
          validateGit(tokens);
        }
      }
    },
  };
};

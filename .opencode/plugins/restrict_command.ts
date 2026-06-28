import type { Plugin } from '@opencode-ai/plugin';

// 危険な git フラグ
const DANGEROUS_GIT_FLAGS = ['--force', '-f', '--hard', '--mirror'];

// バイパス検出パターン (plugin 回避を試みる構文)
const BYPASS_PATTERNS = [
  { pattern: /`[^`]+`/, name: 'backtick command substitution' },
  { pattern: /<\([^)]+\)/, name: 'process substitution' },
  { pattern: /<{3}\s/, name: 'here string' },
];

// Markdown body を受け取るコマンドのホワイトリスト
// これらのコマンドでは backtick (Markdown の inline code) を許可する
// 他のバイパス (process substitution, here string) は引き続きブロック
// process substitution / here string は Markdown 用途がないため、whitelist しても安全
const COMMANDS_WITH_MARKDOWN_BODY = [
  'gh issue create',
  'gh issue edit',
  'gh issue comment',
  'gh pr create',
  'gh pr edit',
  'gh pr comment',
  'gh release create',
  'gh release edit',
  'git commit',
];

const isMarkdownBodyCommand = (command: string): boolean => {
  const trimmed = command.trimStart();
  return COMMANDS_WITH_MARKDOWN_BODY.some((cmd) => trimmed.startsWith(cmd));
};

// parseCommands: bash コマンドをトークンに分割
// heredoc, 引用符, コマンド置換, 変数代入に対応
const parseCommands = (raw: string): string[][] => {
  // heredoc を除去
  const command = raw.replace(/<<-?\s*["']?(\w+)["']?[\s\S]*?\n\s*\1/g, '');

  const segments: string[] = [];
  let current = '';
  let inSingle = false;
  let inDouble = false;
  let parenDepth = 0;

  for (let i = 0; i < command.length; i++) {
    const ch = command[i];
    const next = command[i + 1];

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
        const cmdSubMatch = segment.match(/\$\(([\s\S]+?)\)$/);
        if (cmdSubMatch) {
          const innerCmd = cmdSubMatch[1].trim();
          return innerCmd.split(/\s+/).map((t) => t.replace(/^['"]|['"]$/g, ''));
        }
        return [];
      }
      return segment.split(/\s+/).map((t) => t.replace(/^['"]|['"]$/g, ''));
    })
    .filter((tokens) => tokens.length > 0);
};

// バイパス検出: plugin 回避を試みる構文をチェック
// allowBackticks: true の場合、backtick のみスキップ (Markdown body 想定)
// process substitution / here string は引き続き検出
const checkBypass = (
  raw: string,
  allowBackticks: boolean,
): { detected: boolean; name: string } | null => {
  for (const { pattern, name } of BYPASS_PATTERNS) {
    if (allowBackticks && name === 'backtick command substitution') continue;
    if (pattern.test(raw)) {
      return { detected: true, name };
    }
  }
  return null;
};

// git 危険フラグ検出
const validateGit = (tokens: string[]): string | null => {
  const subcommand = tokens[1];
  if (!subcommand) return null;

  const hasFlag = tokens.some((t) => DANGEROUS_GIT_FLAGS.includes(t));
  if (hasFlag) {
    return `git ${tokens.slice(1).join(' ')} contains a dangerous flag (${DANGEROUS_GIT_FLAGS.filter((f) => tokens.includes(f)).join(', ')}).`;
  }
  return null;
};

// エラーメッセージ生成: explain + コマンド明記
const blockMessage = (reason: string, command: string, alternatives: string): string =>
  [
    `[restrict-commands] BLOCKED: ${reason}`,
    '',
    `Command: ${command}`,
    '',
    `Alternatives: ${alternatives}`,
    '',
    'Please explain to the user:',
    '- What you tried to do',
    '- Why this command was needed',
    '- What alternative you suggest',
    'The user will decide.',
  ].join('\n');

export const RestrictCommandsPlugin: Plugin = async () => {
  return {
    'tool.execute.before': async (input, output) => {
      if (input.tool !== 'bash') return;

      const command: string = output.args?.command ?? '';
      if (!command) return;

      // バイパス検出
      // Markdown body 系のコマンドでは backtick を許可 (process substitution / here string は引き続きブロック)
      const bypass = checkBypass(command, isMarkdownBodyCommand(command));
      if (bypass) {
        throw new Error(
          blockMessage(
            `Bypass pattern detected: ${bypass.name}`,
            command,
            'Use standard command syntax without backticks, process substitution, or here strings. ' +
              'For Markdown content, use --body-file to pass content from a file.',
          ),
        );
      }

      // コマンド解析 + 危険フラグ検出
      const commandSets = parseCommands(command);
      for (const tokens of commandSets) {
        const bin = tokens[0];
        if (!bin) continue;

        if (bin === 'git') {
          const error = validateGit(tokens);
          if (error) {
            throw new Error(
              blockMessage(
                error,
                command,
                'Remove the dangerous flag or use a safer alternative. Example: use `git push` instead of `git push --force`.',
              ),
            );
          }
        }
      }
    },
  };
};

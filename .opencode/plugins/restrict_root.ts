import type { Plugin } from '@opencode-ai/plugin';
import * as os from 'os';
import * as path from 'path';

// bash command から絶対 path を抽出（heuristic）
//  /path or ~/path で始まり、空白/引用/特殊文字以外が続くものを path とみなす
// heredoc の中身、quoted strings の中身はスキップする
const extractPathsFromCommand = (command: string): string[] => {
  // heredoc を除去（<<EOF, <<"EOF", <<'EOF', <<-EOF 対応）
  let cleaned = command.replace(/<<-?\s*["']?(\w+)["']?[\s\S]*?\n\s*\1/g, '');
  // quoted strings を除去（-m "..." などの誤検出を防ぐ）
  cleaned = cleaned.replace(/(["'])(?:\\.|(?!\1)[^\\])*\1/g, '');
  const paths: string[] = [];
  const matches = cleaned.matchAll(/(?:^|[\s>|&;"'])([/~][^\s'"<>|&;]+)/g);
  for (const m of matches) {
    const p = m[1];
    if (p && !p.startsWith('//')) paths.push(p);
  }
  return paths;
};

export const RestrictRootPlugin: Plugin = async ({ worktree }) => {
  const root = path.resolve(worktree);

  // プロジェクトルート以外で許可する外部パス（例外）
  // $XDG_CONFIG_HOME を優先、未設定なら ~/.config にフォールバック
  const xdgConfigHome = process.env.XDG_CONFIG_HOME ?? path.join(os.homedir(), '.config');
  const allowedExternalPaths = [path.join(xdgConfigHome, 'opencode')];

  const normalize = (filePath: string) =>
    new URL(filePath.startsWith('/') ? filePath : `${root}/${filePath}`, 'file://').pathname;

  const isInsideProject = (normalized: string) =>
    normalized === root || normalized.startsWith(root + '/');

  const isInsideAllowedExternal = (normalized: string) =>
    allowedExternalPaths.some((p) => normalized === p || normalized.startsWith(p + '/'));

  const checkPath = (filePath: string) => {
    const normalized = normalize(filePath);
    if (!isInsideProject(normalized) && !isInsideAllowedExternal(normalized)) {
      throw new Error(
        `[restrict-root] Access outside the project root directory is prohibited: ${filePath}`,
      );
    }
  };

  return {
    'tool.execute.before': async (input, output) => {
      // bash tool: command を parse して path を check
      if (input.tool === 'bash' || input.tool === 'shell') {
        const command = String(output?.args?.command ?? '');
        for (const p of extractPathsFromCommand(command)) {
          if (p.startsWith('-')) continue;
          if (p === '/dev/null') continue;
          checkPath(p);
        }
        return;
      }

      // file tool (edit, write, apply_patch, read 等): fileArg を check
      const fileArg: string | undefined =
        output?.args?.filePath ?? output?.args?.path ?? output?.args?.file ?? undefined;

      if (!fileArg) return;
      checkPath(fileArg);
    },
  };
};

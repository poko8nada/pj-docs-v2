import type { Plugin } from '@opencode-ai/plugin';
import * as os from 'os';
import * as path from 'path';

export const RestrictRootPlugin: Plugin = async ({ worktree }) => {
  const root = Bun.resolveSync(worktree, '/'); // realpathの代わり

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

  return {
    'tool.execute.before': async (input, output) => {
      if (input.tool === 'apply_patch') return;

      const fileArg: string | undefined =
        output.args?.filePath ?? output.args?.path ?? output.args?.file ?? undefined;

      if (!fileArg) return;

      const normalized = normalize(fileArg);
      if (!isInsideProject(normalized) && !isInsideAllowedExternal(normalized)) {
        throw new Error(
          `[restrict-root] Access outside the project root directory is prohibited: ${fileArg}`,
        );
      }
    },
  };
};

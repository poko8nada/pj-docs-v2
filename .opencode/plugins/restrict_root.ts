import type { Plugin } from '@opencode-ai/plugin';

export const RestrictRootPlugin: Plugin = async ({ worktree }) => {
  const root = Bun.resolveSync(worktree, '/'); // realpathの代わり

  const isOutside = (filePath: string) => {
    const resolved = filePath.startsWith('/') ? filePath : `${root}/${filePath}`;
    // 正規化（../ などを解決）
    const normalized = new URL(resolved, 'file://').pathname;
    return !normalized.startsWith(root + '/') && normalized !== root;
  };

  return {
    'tool.execute.before': async (input, output) => {
      if (input.tool === 'apply_patch') return;

      const fileArg: string | undefined =
        output.args?.filePath ?? output.args?.path ?? output.args?.file ?? undefined;

      if (fileArg && isOutside(fileArg)) {
        throw new Error(
          `[restrict-root] Access outside the project root directory is prohibited: ${fileArg}`,
        );
      }
    },
  };
};

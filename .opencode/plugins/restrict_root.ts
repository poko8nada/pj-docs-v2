import type { Plugin } from '@opencode-ai/plugin';
import * as path from 'path';

export const RestrictRootPlugin: Plugin = async ({ worktree }) => {
  const root = path.resolve(worktree);

  const isOutside = (filePath: string) => {
    const resolved = path.resolve(filePath);
    return !resolved.startsWith(root + path.sep) && resolved !== root;
  };

  return {
    'tool.execute.before': async (input, output) => {
      // read / write / edit 系のツールを対象にする
      const fileArg = output.args?.filePath ?? output.args?.path ?? output.args?.file ?? null;

      if (fileArg && isOutside(fileArg)) {
        throw new Error(
          `[restrict-root] Access outside the project root directory is prohibited: ${fileArg}`,
        );
      }
    },
  };
};

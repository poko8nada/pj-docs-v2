import type { Plugin } from '@opencode-ai/plugin';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

let lastReadFile: string | null = null;

const normalizePath = (filePath: string): string => {
  if (filePath.startsWith('~/')) {
    return filePath.replace('~', process.env.HOME ?? '');
  }
  return resolve(filePath);
};

export const EnforceReadPlugin: Plugin = async () => {
  return {
    'tool.execute.after': async (input) => {
      if (input.tool !== 'read') return;
      const args = (input.args as Record<string, unknown> | undefined) ?? {};
      const filePath = String(args.filePath ?? args.path ?? '');
      if (!filePath) return;
      try {
        lastReadFile = normalizePath(filePath);
      } catch {
        lastReadFile = filePath;
      }
    },

    'tool.execute.before': async (input, output) => {
      if (input.tool !== 'write') return;

      const args = (output?.args ?? {}) as Record<string, unknown>;
      const filePath = String(args.filePath ?? args.path ?? args.file ?? '');
      if (!filePath) return;

      let normalized: string;
      try {
        normalized = normalizePath(filePath);
      } catch {
        return;
      }

      // 新規 file 作成は read 不要
      if (!existsSync(normalized)) return;

      if (lastReadFile !== normalized) {
        throw new Error(
          `[enforce-read] Last read file was "${lastReadFile ?? 'none'}", but you are writing to "${filePath}". Mismatch. Use the 'read' tool to load ${filePath} first, then retry the write. The 'edit' and 'apply_patch' tools are not subject to this check.`,
        );
      }
    },
  };
};

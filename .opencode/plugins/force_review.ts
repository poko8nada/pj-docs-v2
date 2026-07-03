import type { Plugin } from '@opencode-ai/plugin';
import { createHash } from 'crypto';

// git commit チェーン検出: 単一、または && / ; / | で連結された git commit
const GIT_COMMIT_CHAIN = /(?:^|[&;|]\s*)git\s+commit/;

let isHarnessReleased = false;

interface ForceReviewState {
  pendingStagedHash: string | null;
}

function createState(): ForceReviewState {
  return { pendingStagedHash: null };
}

const sessionStates = new Map<string, ForceReviewState>();

function getState(sessionID: string): ForceReviewState {
  let s = sessionStates.get(sessionID);
  if (!s) {
    s = createState();
    sessionStates.set(sessionID, s);
  }
  return s;
}

export const ForceReviewPlugin: Plugin = async ({ $ }) => {
  return {
    'chat.message': async (input, output) => {
      const textPart = output.parts.find((p) => p.type === 'text' && (p.text ?? '').trim() !== '');
      if (!textPart || textPart.type !== 'text') return;

      const text = textPart.text ?? '';
      const firstLine =
        text
          .split('\n')
          .map((l) => l.trim())
          .find((l) => l.length > 0) ?? '';
      if (text.includes('[release-harness]')) {
        isHarnessReleased = true;
      }
      if (text.includes('[setup]') || /^\s*RESET\s*$/.test(firstLine)) {
        isHarnessReleased = false;
      }
    },

    'tool.execute.before': async (input, output) => {
      if (isHarnessReleased) return;
      if (!input.sessionID) return;
      if (input.tool !== 'bash') return;

      const bashCommand = String((output.args as { command?: string } | undefined)?.command ?? '');
      if (!GIT_COMMIT_CHAIN.test(bashCommand)) return;

      const state = getState(input.sessionID);

      // ワンライナー検出: `git add` と `git commit` が同じコマンド内
      // diff が取れないので standalone commit を強制
      if (/\bgit\s+add\b/.test(bashCommand)) {
        throw new Error(
          '[force-review] git add and git commit in one command. Split into: 1. git add ...  2. git commit -m "..."',
        );
      }

      let diffText = '';
      try {
        diffText = (await $`git diff --staged`.quiet()).text();
      } catch (error) {
        throw new Error('[force-review] Failed to read git diff. Run git add first, then retry.', {
          cause: error,
        });
      }
      if (!diffText.trim()) return; // 空 diff → commit 対象なし、git 側に任せる

      const diffHash = createHash('sha256').update(diffText).digest('hex');

      if (state.pendingStagedHash === diffHash) {
        // 同じ content の consecutive retry: consume して許可
        state.pendingStagedHash = null;
        return;
      }

      // 新規 or 内容違い: block、hash 記録、エラー throw
      state.pendingStagedHash = diffHash;

      let files: string[] = [];
      try {
        const filesText = (await $`git diff --staged --name-only`.quiet()).text().trim();
        files = filesText ? filesText.split('\n').filter(Boolean) : [];
      } catch (error) {
        throw new Error(
          '[force-review] Failed to read staged files. Run git add first, then retry.',
          { cause: error },
        );
      }

      // 単一行で TUI overflow 防止。情報量は十分。
      throw new Error(
        `[force-review] ${files.join(', ')} | call code-reviewer subagent, then retry with the SAME staged content. If content changes, call subagent again.`,
      );
    },
  };
};

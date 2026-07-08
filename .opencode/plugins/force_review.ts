import type { Plugin } from '@opencode-ai/plugin';
import { createHash } from 'crypto';

// git commit チェーン検出: 単一、または && / ; / | で連結された git commit
const GIT_COMMIT_CHAIN = /(?:^|[&;|]\s*)git\s+commit/;

const RESET_TRIGGERS = /^\s*(RESET)\s*$/;

let isHarnessReleased = false;

interface ForceReviewState {
  pendingStagedHash: string | null;
  // ユーザー message の messageID (part filtering 用)
  userMessageIDs: Set<string>;
  // 処理済み partID (dedup 用)
  processedPartIDs: Set<string>;
}

function createState(): ForceReviewState {
  return {
    pendingStagedHash: null,
    userMessageIDs: new Set(),
    processedPartIDs: new Set(),
  };
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
    /* COMMENTED OUT: chat.message フック (OpenCode v1.17.1 で発火しない)
     * https://github.com/anomalyco/opencode/issues/31731
     * トリガー検出は event フックの message.part.updated に移植済み
     *
    "chat.message": async (input, output) => {
      const textPart = output.parts.find((p) => p.type === "text" && (p.text ?? "").trim() !== "");
      if (!textPart || textPart.type !== "text") return;

      const text = textPart.text ?? "";
      const firstLine =
        text
          .split("\n")
          .map((l) => l.trim())
          .find((l) => l.length > 0) ?? "";
      if (text.includes("[release-harness]")) {
        isHarnessReleased = true;
      }
      if (text.includes("[setup]") || /^\s*RESET\s*$/.test(firstLine)) {
        isHarnessReleased = false;
      }
    },
    */

    event: async ({ event }) => {
      // message.updated: ユーザー message の messageID を記録
      // chat.message 代替 (v1.17.1 で発火しないため event バスで処理)
      if (event.type === 'message.updated') {
        const { info } = event.properties;
        if (info.role === 'user') {
          const state = getState(info.sessionID);
          state.userMessageIDs.add(info.id);
        }
        return;
      }

      // message.removed: userMessageIDs と同期 (DB との整合性)
      if (event.type === 'message.removed') {
        const { sessionID, messageID } = event.properties;
        const state = getState(sessionID);
        state.userMessageIDs.delete(messageID);
        return;
      }

      // message.part.updated: ユーザー message の text part のみ処理
      if (event.type === 'message.part.updated') {
        const { part } = event.properties;
        if (part.type !== 'text') return;

        const state = getState(part.sessionID);
        if (!state.userMessageIDs.has(part.messageID)) return;
        if (state.processedPartIDs.has(part.id)) return;
        state.processedPartIDs.add(part.id);

        const text = part.text;
        if (!text.trim()) return;

        // trigger は firstLine 基準で統一 (execution_gate.ts と一貫)
        const firstLine =
          text
            .split('\n')
            .map((l) => l.trim())
            .find((l) => l.length > 0) ?? '';

        if (firstLine === '[release-harness]') {
          isHarnessReleased = true;
        }
        if (firstLine.startsWith('[setup]') || RESET_TRIGGERS.test(firstLine)) {
          isHarnessReleased = false;
        }
        return;
      }

      // message.part.removed: processedPartIDs と同期
      if (event.type === 'message.part.removed') {
        const { sessionID, partID } = event.properties;
        const state = getState(sessionID);
        state.processedPartIDs.delete(partID);
        return;
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

import type { Plugin } from '@opencode-ai/plugin';

// phase → load の対応
const PHASE_LOADS = {
  open_discussion: null,
  design: { feasibility: false, prepare: false },
  build: { feasibility: false, prepare: false },
  refine: { feasibility: false, prepare: false },
  chore: null,
} as const;

type PhaseType = keyof typeof PHASE_LOADS;

type Skills = {
  [K in PhaseType]: { type: K; load: (typeof PHASE_LOADS)[K] };
}[PhaseType];

interface SessionState {
  phase: PhaseType;
  skills: Skills;
  excutionSkillTriggered: boolean;

  userTriggered: boolean;
  pendingOutputTool: string | null;
  lastEvent: string | null;
  // ユーザー message の messageID (part filtering 用)
  userMessageIDs: Set<string>;
  // 処理済み partID (dedup 用)
  processedPartIDs: Set<string>;
  // gh 実行系の issue スキルゲート
  issueSkillTurnsRemaining: number;
  readFiles: Set<string>;
  // GO 以降に実行ツールを使ったか
  toolsExecutedSinceGo: boolean;
}

function defaultState(): SessionState {
  return {
    phase: 'open_discussion',
    skills: {
      type: 'open_discussion',
      load: null,
    },
    excutionSkillTriggered: false,
    userTriggered: false,
    pendingOutputTool: null,
    lastEvent: null,
    userMessageIDs: new Set(),
    processedPartIDs: new Set(),
    issueSkillTurnsRemaining: 0,
    readFiles: new Set(),
    toolsExecutedSinceGo: false,
  };
}

// モジュール変数: RESET トリガーでのみクリア
let isHarnessReleased = false;

// モデル切替検知用
let lastModelId: string | null = null;

const sessions = new Map<string, SessionState>();

function getState(sessionID: string): SessionState {
  let state = sessions.get(sessionID);
  if (!state) {
    state = defaultState();
    sessions.set(sessionID, state);
  }
  return state;
}

function resetState(sessionID: string) {
  sessions.set(sessionID, defaultState());
}

const EXECUTION_SKILLS = ['implement', 'debug', 'image-search', 'readme'];

// issue スキルの有効ターン数 (ユーザーメッセージを跨いで生存)
const ISSUE_SKILL_TURNS = 2;

// タイトルプレフィックス → 対応リファレンス
const PREFIX_REFERENCES: Record<string, string> = {
  '[Spec]': '.opencode/skills/issue/references/spec-template.md',
  '[Design]': '.opencode/skills/issue/references/design-template.md',
  '[Build]': '.opencode/skills/issue/references/build-template.md',
  '[Refine]': '.opencode/skills/issue/references/refine-template.md',
};

// allowlist: tools that BYPASS the gate (read-only / workflow helpers / MCP ツール)
// gate が必要な tool (edit / write / patch / list / bash / todoread / MCP 由来) はここに含めない
const ALLOW_TOOLS = new Set([
  // read-only
  'read',
  'grep',
  'glob',
  'websearch',
  'webfetch',
  'lsp',
  // workflow
  'skill',
  'question',
  'task',
  'todowrite',
]);

// MCP tool 命名規約: <server>_<tool> 形式 (OpenCode Book §8.2)
// 例: context7_query-docs, mcp_bash, nocturne-memory_read_memory, my-jira_search_issues
// ビルトインツールには underscore がないので false-positive なし
const MCP_TOOL_PATTERN = /^[a-zA-Z0-9_-]+_[a-zA-Z0-9_-]+$/;

function isAllowedTool(toolName: string): boolean {
  if (ALLOW_TOOLS.has(toolName)) return true;
  if (MCP_TOOL_PATTERN.test(toolName)) return true;
  return false;
}

// git read-only subcommands that bypass the gate
// `branch` は除外: `git branch -d main` (削除) など write 操作もマッチしてしまうため
// 代わりに `git status` でブランチ情報を確認可能
const GIT_READONLY = /^(diff|log|status|show|remote|tag|stash\s+list|reflog|blame|shortlog)\b/;

const BASH_READONLY =
  /^\s*(grep|rg|find|ls|cat|head|tail|wc|sort|uniq|diff|echo|printf|date|pwd|which|type|file|stat|du|df|env|printenv|history|ps|top|free|uptime|w|who|id|groups)\b/;

// gh read-only subcommands (gate バイパス): 現状確認用
// create / edit / close / comment / merge / delete / ssh / clone / watch / api 等は working 扱い
// 安全側に倒すため、allowlist にない gh コマンドは gate 必須 (working gh check で専用エラー)
// search 系は全 subcommand が read-only なので専用パターン
const GH_READONLY_VERBS =
  'view|list|status|checks|diff|logs|ports|get|token|download|verify|verify-asset|trusted-root|check|gitignore|license|field-list|item-list';
const GH_READONLY_RESOURCES =
  'issue|pr|release|repo|run|workflow|auth|org|label|alias|attestation|cache|config|codespace|gist|gpg-key|project|ruleset|search|secret|ssh-key|variable';
const GH_READONLY = new RegExp(
  `^\\s*gh\\s+(?:${GH_READONLY_RESOURCES})\\s+(?:${GH_READONLY_VERBS})\\b`,
);
// gh search: 全 subcommand が read-only (code, commits, issues, prs, repos, users)
// 汎用 GH_READONLY に含めると `gh codespace code` 等が bypass されるため分離
const GH_SEARCH_READONLY = /^\s*gh\s+search\s+(?:code|commits|issues|prs|repos|users)\b/;
// gh completion: shell 名 (bash, fish, powershell, zsh) を readonly verb に入れると
// `gh issue bash` のような false positive が出るため専用パターン
const GH_COMPLETION_READONLY = /^\s*gh\s+completion\s+(?:bash|fish|powershell|zsh)\b/;
// standalone (subcommand なし): --help, --version, help [topic], status, browse, completion, licenses, preview
const GH_READONLY_STANDALONE =
  /^\s*gh\s+(?:--?help|-h|-v|--?version|help(?:\s+\S+)?|status|browse|completion|licenses|preview)\s*$/;

// 外部 CLI プレフィックス (gate を bypass する bash コマンド群)
// 用途: gog (Google Workspace) / cmux (browser automation)
// 注意: write 可能な操作も含むため、使用は user の判断に委ねる
const BASH_EXTERNAL_CLI = /^\s*(gog|cmux)(\s|$|;|\||&)/;

// bash read-only コマンドを判定する関数
function isBashReadOnly(command: string): boolean {
  const trimmed = command.trimStart();
  return (
    BASH_READONLY.test(trimmed) ||
    (/^git\s+/.test(trimmed) && GIT_READONLY.test(trimmed.replace(/^git\s+/, ''))) ||
    GH_READONLY.test(trimmed) ||
    GH_SEARCH_READONLY.test(trimmed) ||
    GH_COMPLETION_READONLY.test(trimmed) ||
    GH_READONLY_STANDALONE.test(trimmed) ||
    BASH_EXTERNAL_CLI.test(trimmed)
  );
}

// trigger words — first line, exact match (case sensitive)
// 規約: trigger は文頭かつ完全一致。コンテンツを続けたい場合は改行で区切る。
const EXECUTE_TRIGGERS = /^\s*(GO)\s*$/;
const RESET_TRIGGERS = /^\s*(RESET)\s*$/;
const STATE_TRIGGER = /^\s*(STATE)\s*$/;

// md ファイル (.opencode 配下以外) は gate バイパス
// docs/, README.md, 任意の *.md など user/project content は
// セットアップ/feasibility/プラン/GO/execution skill を要求せず自由に作成更新可
// .opencode/ 配下の md は system なので通常 gate 適用
function isFreeMarkdownPath(filePath: string): boolean {
  if (!filePath.endsWith('.md')) return false;
  // .opencode/ で始まるか、任意のパスに .opencode/ を含む場合は system content として保護
  if (filePath.startsWith('.opencode/') || filePath.includes('/.opencode/')) return false;
  return true;
}

// gh issue create/edit の --title / -t からタイトル文字列を抽出
export function extractGhTitle(command: string): string | null {
  const match = command.match(/(?:--title|-t)\s+"([^"]*)"/);
  return match ? match[1] : null;
}

// タイトルから一致するプレフィックスを検出
export function detectPrefix(title: string): string | null {
  for (const prefix of Object.keys(PREFIX_REFERENCES)) {
    if (title.startsWith(prefix)) return prefix;
  }
  return null;
}

// gh 実行系コマンドのバリデーション。null なら許可、文字列ならブロック理由
export function validateGhCommand(
  state: { issueSkillTurnsRemaining: number; readFiles: Set<string> },
  command: string,
): string | null {
  if (state.issueSkillTurnsRemaining <= 0) {
    return 'issue skill not triggered (or turns expired)';
  }
  const title = extractGhTitle(command);
  if (title) {
    const prefix = detectPrefix(title);
    if (prefix) {
      const refFile = PREFIX_REFERENCES[prefix];
      if (!state.readFiles.has(refFile)) {
        return `reference not read: ${refFile}`;
      }
    }
  }
  return null;
}

function formatState(state: SessionState): string {
  if (isHarnessReleased) return '## Execution Gate State\n- Harness released';
  const phase = state.phase;
  const load = state.skills?.load;

  let skillsLoad = '';
  const missing: string[] = [];
  if (load) {
    const entries = Object.keys(load);
    skillsLoad = entries
      .map((skill) => {
        const done = load[skill as keyof typeof load];
        if (!done) missing.push(skill);
        return `- ${skill}: ${done ? '✓' : '✗'}`;
      })
      .join('\n');
  }

  const excution = state.excutionSkillTriggered;
  const userReady = state.userTriggered;
  const issueTurns = state.issueSkillTurnsRemaining;

  // 次に何をすべきか
  let next = '';
  if (phase === 'open_discussion') {
    next = 'Say [setup] design/build/refine/chore to begin';
  } else if (missing.length > 0) {
    next = `Trigger: ${missing.join(' → ')}`;
  } else if (!excution) {
    next = 'Trigger an execution skill (implement, debug, etc.)';
  } else if (!userReady) {
    next = "Say 'GO' to unlock execution tools";
  } else {
    next = 'All conditions met. Execute.';
  }

  return `## Execution Gate State
  - Phase: ${phase}
  - Skills: ${skillsLoad || '(none required)'}
  - Execution Skill: ${excution ? '✓' : '✗'}
  - User Ready: ${userReady ? '✓' : '✗'}
  - Issue Turns: ${issueTurns}
  - Next: ${next}`;
}

// フェーズに応じた行動制約
function phaseDirective(phase: string): string {
  switch (phase) {
    case 'open_discussion':
      return 'You are in open-discussion. DISCUSS and PROPOSE only. You CANNOT write code or edit files.';
    case 'design':
      return 'You are in design phase. Build prototype, discuss, expand to full scope, produce design spec (Style Guide, matrices). Use feasibility → prepare → implement skills. GO resets after each execution turn. Do NOT implement production code.';
    case 'build':
      return 'You are in build phase. PLAN then IMPLEMENT. Use feasibility → prepare → implement skills. GO resets after each execution turn.';
    case 'refine':
      return 'You are in refine phase. ANALYZE then IMPROVE. Use feasibility → prepare → implement skills. GO resets after each execution turn.';
    case 'chore':
      return 'You are in chore phase. Minor changes only — harness, typos, config.';
    default:
      return '';
  }
}

export const ExecutionGatePlugin: Plugin = async ({ client }) => {
  // subagent session は gate 状態不要 (inject_context と同じ判断)
  const subagentSessions = new Set<string>();

  return {
    event: async ({ event }) => {
      // session.created: subagent 判定 + state リセット
      if (event.type === 'session.created') {
        const info = event.properties.info;
        if (info.parentID) {
          subagentSessions.add(info.id);
        } else {
          resetState(info.id);
        }
      }
      // session.compacted: リセットしない (続行前提)

      // message.updated: ユーザー message の messageID を記録
      // chat.message 代替 (v1.17.1 で発火しないため event バスで処理)
      // https://github.com/anomalyco/opencode/issues/31731
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
        if (subagentSessions.has(part.sessionID)) return;

        const state = getState(part.sessionID);
        if (!state.userMessageIDs.has(part.messageID)) return;
        if (state.processedPartIDs.has(part.id)) return;
        state.processedPartIDs.add(part.id);

        // ユーザーターン消費: issue スキルの有効ターンをデクリメント + GO を消費（実行があった場合のみ）
        if (state.issueSkillTurnsRemaining > 0) {
          state.issueSkillTurnsRemaining--;
        }
        if (state.toolsExecutedSinceGo) {
          state.userTriggered = false;
          state.toolsExecutedSinceGo = false;
        }

        const text = part.text;
        if (!text.trim()) return;

        const firstLine =
          text
            .split('\n')
            .map((l) => l.trim())
            .find((l) => l.length > 0) ?? '';

        if (STATE_TRIGGER.test(firstLine)) {
          // STATE 表示: client.tui.showToast で TUI に toast として表示
          // (event フックには output.parts が無いので、chat.message 時代の
          //  chat 内表示は不可。toast は ephemeral だが state 確認には十分)
          state.lastEvent = 'state display requested';
          await client.tui.showToast({
            body: {
              title: 'Execution Gate',
              message: formatState(state),
              variant: 'info',
              duration: 10000, // 10s — state 全体を読むのに十分な時間
            },
          });
          return;
        }

        if (text.includes('[release-harness]')) {
          isHarnessReleased = true;
          // formatState は isHarnessReleased=true で "Harness released" を返す
          await client.tui.showToast({
            body: {
              title: 'Execution Gate',
              message: formatState(state),
              variant: 'info',
              duration: 10000,
            },
          });
        }

        if (text.includes('[setup]')) {
          isHarnessReleased = false;
          const phaseMatch = text.match(/\[setup\]\s+(design|build|refine|chore)/);
          const phase = (phaseMatch ? phaseMatch[1] : 'open_discussion') as PhaseType;
          state.phase = phase;
          state.skills = { type: phase, load: PHASE_LOADS[phase] } as Skills;
          state.lastEvent = `phase set to ${phase}`;
          await client.tui.showToast({
            body: {
              title: 'Execution Gate',
              message: formatState(state),
              variant: 'info',
              duration: 10000,
            },
          });
          return;
        }

        if (RESET_TRIGGERS.test(firstLine)) {
          resetState(part.sessionID);
          isHarnessReleased = false;
          const s = getState(part.sessionID);
          s.lastEvent = 'state reset';
          await client.tui.showToast({
            body: {
              title: 'Execution Gate',
              message: formatState(s),
              variant: 'info',
              duration: 10000,
            },
          });
          return;
        }

        if (EXECUTE_TRIGGERS.test(firstLine)) {
          state.userTriggered = true;
          state.lastEvent = 'user trigger GO — gate opened, proceed with implementation';
          await client.tui.showToast({
            body: {
              title: 'Execution Gate',
              message: formatState(state),
              variant: 'info',
              duration: 10000,
            },
          });
        }
      }

      // message.part.removed: processedPartIDs と同期
      if (event.type === 'message.part.removed') {
        const { sessionID, partID } = event.properties;
        const state = getState(sessionID);
        state.processedPartIDs.delete(partID);
        return;
      }
    },

    // ── experimental.chat.system.transform: LLM に gate state を注入 ─────
    // agent が任意時点で現在の gate 状況 (level, conditions, lastEvent) を把握できる
    // chat.message 経由の push は廃止 (opencode #885 / #23440 で不安定なため)
    'experimental.chat.system.transform': async (input, output) => {
      if (!input.sessionID) return;
      if (subagentSessions.has(input.sessionID)) return; // skip subagent
      const state = getState(input.sessionID);
      if (!state) return;

      // モデル切替検知: 前回と異なるモデルIDなら要約を注入 + トースト
      const currentModelId = input.model?.id;
      if (currentModelId && currentModelId !== lastModelId) {
        const switched = lastModelId !== null;
        lastModelId = currentModelId;
        if (switched) {
          await client.tui.showToast({
            body: {
              title: 'Execution Gate',
              message: formatState(state),
              variant: 'info',
              duration: 10000,
            },
          });
          output.system.push(
            `[Model switched to ${currentModelId}]\nSession context is preserved. Current state:\n${formatState(state)}`,
          );
          output.system.push(phaseDirective(state.phase));
          return;
        }
      }

      output.system.push(formatState(state));
      output.system.push(phaseDirective(state.phase));
    },

    /* COMMENTED OUT: chat.message フック (OpenCode v1.17.1 で発火しない)
     * https://github.com/anomalyco/opencode/issues/31731
     * トリガー検出は event フックの message.updated に移植済み
     *
    "chat.message": async (input, output) => {
      if (!input.sessionID) return;
      const state = getState(input.sessionID);

      // ユーザー入力 text part を取得
      // - execution_gate 自身が injectStatus で注入する `prt_` prefix の part はスキップ
      //   (inject のテキストが trigger word 検出を妨げるため)
      // - 空 text part もスキップ (multiline input の冒頭空対策)
      const textPart = output.parts.find(
        (p) =>
          p.type === "text" &&
          !p.id?.startsWith("prt_") &&
          (p.text ?? "").trim() !== "",
      );
      if (!textPart || textPart.type !== "text") return;

      const text = textPart.text ?? "";
      // 最初の非空行を trigger word 検出に使う
      // ユーザが先頭に空行入れても trigger を効かせるため
      const firstLine =
        text
          .split("\n")
          .map((l) => l.trim())
          .find((l) => l.length > 0) ?? "";

      const injectStatus = (s: SessionState) => {
        const messageID = output.message.id;
        if (messageID) {
          output.parts.push({
            type: "text",
            id: `prt_${crypto.randomUUID()}`,
            sessionID: input.sessionID,
            messageID,
            text: `${formatState(s)}`,
          });
        }
      };

      if (STATE_TRIGGER.test(firstLine)) {
        state.lastEvent = "state display requested";
        injectStatus(state);
        return;
      }

      // 部分一致: メッセージ内の任意の位置で発火可能
      if (text.includes("[release-harness]")) {
        isHarnessReleased = true;
      }

      if (text.includes("[setup]")) {
        isHarnessReleased = false;
        const phaseMatch = text.match(
          /\[setup\]\s+(design|build|refine|chore)/,
        );
        const phase = (
          phaseMatch ? phaseMatch[1] : "open_discussion"
        ) as PhaseType;

        if (phase) {
          state.phase = phase;
          state.skills = { type: phase, load: PHASE_LOADS[phase] } as Skills;
          state.lastEvent = `phase set to ${phase}`;
        }
        return;
      }

      if (RESET_TRIGGERS.test(firstLine)) {
        resetState(input.sessionID);
        isHarnessReleased = false;
        const s = getState(input.sessionID);
        s.lastEvent = "state reset";
        injectStatus(s);
        return;
      }

      if (EXECUTE_TRIGGERS.test(firstLine)) {
        state.userTriggered = true;
        state.lastEvent =
          "user trigger GO — gate opened, proceed with implementation";
      }
    },
    */

    'tool.execute.after': async (input, _output) => {
      if (!input.sessionID) return;
      const state = getState(input.sessionID);

      if (input.tool === 'skill') {
        const args = input.args as { name?: string } | undefined;
        const name = args?.name;
        if (!name) return;

        // issue スキル: gh 実行系ゲートの有効ターンをリセット
        if (name === 'issue') {
          state.issueSkillTurnsRemaining = ISSUE_SKILL_TURNS;
          state.readFiles.clear();
          await client.tui.showToast({
            body: {
              title: 'Execution Gate',
              message: formatState(state),
              variant: 'info',
              duration: 10000,
            },
          });
          return;
        }

        const load = state.skills.load;
        if (load) {
          let stateChanged = false;
          if (name in load) {
            state.skills = {
              ...state.skills,
              load: { ...load, [name]: true } as typeof load,
            };
            stateChanged = true;
          }
          if (EXECUTION_SKILLS.includes(name)) {
            state.excutionSkillTriggered = true;
            stateChanged = true;
          }
          if (stateChanged) {
            await client.tui.showToast({
              body: {
                title: 'Execution Gate',
                message: formatState(state),
                variant: 'info',
                duration: 10000,
              },
            });
          }
        }

        return;
      }

      // read ツールの追跡 (issue リファレンス read 検知用)
      if (input.tool === 'read') {
        const filePath = input.args?.filePath as string | undefined;
        if (filePath) {
          state.readFiles.add(filePath);
        }
      }

      // 実行ツール使用フラグ (GO 消費判定用)
      if (!isAllowedTool(input.tool)) {
        state.toolsExecutedSinceGo = true;
      }
    },

    'tool.execute.before': async (input, output) => {
      if (!input.sessionID) return;
      const state = getState(input.sessionID);

      if (isHarnessReleased) return;

      // execution_gate.ts 自体へのアクセスは ハーネスリリースのみ許可 (自己保護)
      if (input.tool === 'edit' || input.tool === 'write' || input.tool === 'patch') {
        const filePath = String((output.args as { filePath?: string } | undefined)?.filePath ?? '');
        if (filePath.endsWith('/plugins/execution_gate.ts')) {
          throw new Error(
            `[execution-gate] Cannot edit '${filePath}'. Set LV0 (harness release) to modify the gate itself.`,
          );
        }
        if (isFreeMarkdownPath(filePath)) {
          return;
        }
      }

      if (isAllowedTool(input.tool)) return;

      let bashCommand = '';
      if (input.tool === 'bash') {
        bashCommand = String((output.args as { command?: string } | undefined)?.command ?? '');
        if (isBashReadOnly(bashCommand)) return;

        // working gh check: issue スキルゲート + プレフィックス検証
        // read-only gh は前段の isBashReadOnly で bypass 済み
        const trimmed = bashCommand.trimStart();
        if (/^\s*gh\s+/.test(trimmed)) {
          if (state.phase === 'open_discussion') {
            throw new Error(
              `[execution-gate] Blocked — gh commands require a phase.\n` +
                `Next step: Say '[setup] design' (or build/refine/chore)`,
            );
          }

          // issue スキルゲート: 有効ターン内か + プレフィックス検証
          const ghError = validateGhCommand(state, trimmed);
          if (ghError) {
            throw new Error(
              `[execution-gate] Blocked — ${ghError}.\n` +
                `Next step: Trigger 'issue' skill and read the required references.`,
            );
          }

          return; // gh は専用ゲート通過で許可
        }
      }

      // open discussion なら全ブロック (phase チェック)
      if (state.phase === 'open_discussion') {
        throw new Error(
          `[execution-gate] Blocked — open discussion phase.\n` +
            `Next step: Ask user to set a phase with [setup] design/build/refine/chore`,
        );
      }

      const missing: string[] = [];
      const steps: string[] = [];

      const load = state.skills.load;
      if (load) {
        for (const skill of Object.keys(load)) {
          if (!load[skill as keyof typeof load]) {
            missing.push(skill);
          }
        }
      }

      if (missing.length > 0) {
        steps.push(`1. Trigger: ${missing.join(' → ')}`);
      }

      if (!state.excutionSkillTriggered) {
        steps.push(
          `${steps.length + 1}. Trigger an execution skill (${EXECUTION_SKILLS.join(', ')})`,
        );
      }

      if (!state.userTriggered) {
        steps.push(
          `${steps.length + 1}. Say 'GO' (GO alone is not enough — all steps above must be done first)`,
        );
      }

      if (steps.length > 0) {
        throw new Error(`[execution-gate] Blocked. Complete these steps:\n${steps.join('\n')}`);
      }
    },
  };
};

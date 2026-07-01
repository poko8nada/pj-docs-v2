import type { Plugin } from '@opencode-ai/plugin';
import { createHash } from 'crypto';

// ── types ────────────────────────────────────────────────────────────────────

type SetupIssue =
  | { action: 'reference'; number: number; url: string }
  | { action: 'create' }
  | null;

interface SetupData {
  topic: string;
  goal: string;
  gate: string;
  issue: SetupIssue;
}

interface TechFeasibilityData {
  topics: string[];
}

interface PlanData {
  fileChanges: { path: string; type: 'new' | 'edit' | 'delete' }[];
}

interface SessionState {
  level: 0 | 1 | 2 | 3;
  // スキル発火フラグ
  setupSkillTriggered: boolean;
  techFeasibilitySkillTriggered: boolean;
  planSkillTriggered: boolean;
  // ツール検証フラグ
  setupToolVerified: boolean;
  setupData: SetupData | null;
  techFeasibilityToolVerified: boolean;
  techFeasibilityData: TechFeasibilityData | null;
  planToolVerified: boolean;
  planData: PlanData | null;
  // tech-feasibility ツール呼び出し回数
  techFeasibilityToolCount: number;
  // 調査ツール (websearch / webfetch / context7_query-docs) の累積呼び出し回数
  techFeasibilityInvestigationCount: number;
  // 1 shot 目で commit された topic 数 (tech-feasibility tool の topics.length)
  techFeasibilityTopicCount: number;
  // 2 shot 目で commit された追加 topic 数 (LV3 のみ)
  techFeasibilityAdditionalTopicCount: number;
  // 実行スキル
  executionSkillsLoaded: string[];
  // ユーザートリガー
  userTriggered: boolean;
  // チャット出力追跡：各ツール呼び出し後にアシスタントメッセージが必要
  setupOutputShown: boolean;
  techFeasibilityOutputShown: boolean;
  planOutputShown: boolean;
  pendingOutputTool: 'setup' | 'tech-feasibility' | 'plan' | null;
  // force-review: 直前の block で記録した staged diff hash。consecutive 同じ hash なら 1 回限り許可
  pendingStagedHash: string | null;
  // 直近の trigger 状況 (agent が任意時点で把握できるよう system.transform に注入)
  lastEvent: string | null;
}

function defaultState(): SessionState {
  return {
    level: 2,
    setupSkillTriggered: false,
    techFeasibilitySkillTriggered: false,
    planSkillTriggered: false,
    setupToolVerified: false,
    setupData: null,
    techFeasibilityToolVerified: false,
    techFeasibilityData: null,
    planToolVerified: false,
    planData: null,
    techFeasibilityToolCount: 0,
    techFeasibilityInvestigationCount: 0,
    techFeasibilityTopicCount: 0,
    techFeasibilityAdditionalTopicCount: 0,
    executionSkillsLoaded: [],
    userTriggered: false,
    setupOutputShown: false,
    techFeasibilityOutputShown: false,
    planOutputShown: false,
    pendingOutputTool: null,
    pendingStagedHash: null,
    lastEvent: null,
  };
}

// ── state ────────────────────────────────────────────────────────────────────

// ツールの戻り値から issue フィールドを安全に取り出す
function parseSetupIssue(raw: unknown): SetupIssue {
  if (raw === null || raw === undefined) return null;
  if (typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  if (obj.action === 'create') return { action: 'create' };
  if (obj.action === 'reference' && typeof obj.number === 'number' && typeof obj.url === 'string') {
    return { action: 'reference', number: obj.number, url: obj.url };
  }
  return null;
}

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

// ── constants ────────────────────────────────────────────────────────────────

const EXECUTION_SKILLS = ['implement', 'debug', 'apply-pattern', 'issue', 'readme'];

// allowlist: tools that BYPASS the gate (read-only / workflow helpers / カスタム workflow)
// gate が必要な tool (edit / write / patch / list / bash / todoread / MCP 由来) はここに含めない
// 旧: `gh` / `gog` / `cmux` / `pnpm` / `npx` / `tsc` / `tsc-files` / `vitest` / `mcp_` prefix は不正確なため削除
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
  // our custom tools
  'setup',
  'tech-feasibility',
  'plan',
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

// リサーチ調査ツール: 公式 (context7) / 実践・反例 (websearch) / 補助 (webfetch)
// スキルの Step 3 (Investigation) で使用。これら 1 回 = 1 investigation。
// tech-feasibility ツール (gate 検証用) とは別物。混同しないこと。
const RESEARCH_INVESTIGATION_TOOLS = new Set([
  'websearch', // built-in: 実践・反例 source の発見
  'webfetch', // built-in: 公式 URL の取得 (context7 で取得できない時)
  'context7_query-docs', // MCP (context7 server): 公式 docs
]);
function isInvestigationTool(toolName: string): boolean {
  return RESEARCH_INVESTIGATION_TOOLS.has(toolName);
}

// git read-only subcommands that bypass the gate
// `branch` は除外: `git branch -d main` (削除) など write 操作もマッチしてしまうため
// 代わりに `git status` でブランチ情報を確認可能
const GIT_READONLY = /^(diff|log|status|show|remote|tag|stash\s+list|reflog|blame|shortlog)\b/;

// bash read-only commands that bypass the gate
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
// gh は意図的に除外: read-only 系のみ GH_READONLY / GH_SEARCH_READONLY / GH_READONLY_STANDALONE で個別バイパス
// working 系は tool.execute.before の working gh check で gate 必須になる
const BASH_EXTERNAL_CLI = /^\s*(gog|cmux)(\s|$|;|\||&)/;

// git commit チェーン検出 (gate ブロックではなく workflow リセット用)
// 単一、または && / ; / | で連結された git commit を検出
// force-review.ts 側とは別実装 (疎結合)
const GIT_COMMIT_CHAIN = /(?:^|[&;|]\s*)git\s+commit/;

// trigger words — first line, exact match (case sensitive)
// 規約: trigger は文頭かつ完全一致。コンテンツを続けたい場合は改行で区切る。
//   STATE
//   でさ。。。
//   ↑ trigger (単独)   ↑ コンテンツ (任意)
// 自然文の単語誤爆を防ぐため、trigger は "l<N>" 形式または ALL CAPS 英語 1 語に限定
const LV0_TRIGGERS = /^\s*(l0|LV0)\s*$/;
const LV1_TRIGGERS = /^\s*(l1|LV1|TRIVIAL)\s*$/;
const LV2_TRIGGERS = /^\s*(l2|LV2|PLAN)\s*$/;
const LV3_TRIGGERS = /^\s*(l3|LV3|DEEP)\s*$/;
const EXECUTE_TRIGGERS = /^\s*(GO)\s*$/;
const DONE_TRIGGERS = /^\s*(DONE)\s*$/;

// STATE display trigger
const STATE_TRIGGER = /^\s*(STATE)\s*$/;

// tech-feasibility required tool count per level
// LV2: 1 call (single shot)
// LV3: 2 calls (2-shot + user discussion between shots)
function requiredResearch(level: 0 | 1 | 2 | 3): number {
  if (level === 0) return 0;
  if (level === 1) return 0;
  if (level === 2) return 1;
  return 2; // level 3
}

function levelName(level: 0 | 1 | 2 | 3): string {
  if (level === 0) return 'Harness release';
  if (level === 1) return 'Light';
  if (level === 2) return 'Default';
  return 'Plan';
}

// md ファイル (.opencode 配下以外) は gate バイパス
// docs/, README.md, 任意の *.md など user/project content は
// セットアップ/tech-feasibility/プラン/GO/execution skill を要求せず自由に作成更新可
// .opencode/ 配下の md は system なので通常 gate 適用
function isFreeMarkdownPath(filePath: string): boolean {
  if (!filePath.endsWith('.md')) return false;
  if (filePath.startsWith('.opencode/') || filePath.includes('/.opencode/')) return false;
  return true;
}

// LLM に渡す state 記述。任意時点で agent が把握できるよう system.transform 経由
// user-visible state とは別物: agent 向け (英語、lastEvent 含む、next action 提案)
function formatStateForAgent(state: SessionState): string {
  const req = requiredResearch(state.level);
  const totalTopics = state.techFeasibilityTopicCount + state.techFeasibilityAdditionalTopicCount;
  const lines = ['## Execution Gate State', `- Level: ${state.level} (${levelName(state.level)})`];
  if (state.lastEvent) {
    lines.push(`- Last event: ${state.lastEvent}`);
  }
  lines.push(
    `- Setup: skill ${state.setupSkillTriggered ? '✓' : '✗'} | tool ${state.setupToolVerified ? '✓' : '✗'} | chat ${state.setupOutputShown ? '✓' : '✗'}`,
    `- Tech-feasibility: skill ${state.techFeasibilitySkillTriggered ? '✓' : '✗'} | tool ${state.techFeasibilityToolCount}/${req} ${state.techFeasibilityToolVerified ? '✓' : '✗'} | chat ${state.techFeasibilityOutputShown ? '✓' : '✗'}`,
    `- Investigation: ${state.techFeasibilityInvestigationCount}/${totalTopics} (websearch/webfetch/context7 calls vs committed topics)`,
    `- Plan: skill ${state.planSkillTriggered ? '✓' : '✗'} | tool ${state.planToolVerified ? '✓' : '✗'} | chat ${state.planOutputShown ? '✓' : '✗'}`,
    `- Trigger: ${state.userTriggered ? '✓' : '✗'}`,
    `- Execution skills: ${state.executionSkillsLoaded.length > 0 ? '✓' : '✗'}`,
  );
  return lines.join('\n');
}

// ── plugin ───────────────────────────────────────────────────────────────────

export const ExecutionGatePlugin: Plugin = async ({ $ }) => {
  // subagent session は gate 状態不要 (inject_context と同じ判断)
  const subagentSessions = new Set<string>();

  return {
    // ── event: session lifecycle ────────────────────────────────────────────
    event: async ({ event }) => {
      if (event.type === 'session.created') {
        const info = event.properties.info;
        if (info.parentID) {
          subagentSessions.add(info.id);
        } else {
          resetState(info.id);
        }
      }
      // session.compacted: リセットしない (続行前提)
    },

    // ── experimental.chat.system.transform: LLM に gate state を注入 ─────
    // agent が任意時点で現在の gate 状況 (level, conditions, lastEvent) を把握できる
    // chat.message 経由の push は廃止 (opencode #885 / #23440 で不安定なため)
    'experimental.chat.system.transform': async (input, output) => {
      if (!input.sessionID) return;
      if (subagentSessions.has(input.sessionID)) return; // skip subagent
      const state = getState(input.sessionID);
      if (!state) return;
      output.system.push(formatStateForAgent(state));
    },

    // ── chat.message: trigger word scanning ────────────────────────────────
    'chat.message': async (input, output) => {
      if (!input.sessionID) return;
      const message = output.message;
      if (!message) return;
      const state = getState(input.sessionID);

      // ユーザー入力 text part を取得
      // - inject_context が `prt_inject_` prefix で注入する part はスキップ
      //   (文頭に inject 状況がくると trigger word 検出が機能しないため)
      // - 空 text part もスキップ (multiline input の冒頭空対策)
      const textPart = output.parts.find(
        (p) =>
          p.type === 'text' && !p.id?.startsWith('prt_inject_') && (p.text ?? '').trim() !== '',
      );
      if (!textPart || textPart.type !== 'text') return;

      const text = textPart.text ?? '';
      // 最初の非空行を trigger word 検出に使う
      // ユーザが先頭に空行入れても trigger を効かせるため
      const firstLine =
        text
          .split('\n')
          .map((l) => l.trim())
          .find((l) => l.length > 0) ?? '';

      // session-resume: [session-resume] マーカーを検出 → 全 condition OK
      if (text.includes('[session-resume]')) {
        const req = requiredResearch(state.level);
        state.setupSkillTriggered = true;
        state.setupToolVerified = true;
        state.setupOutputShown = true;
        state.techFeasibilitySkillTriggered = true;
        state.techFeasibilityToolVerified = true;
        state.techFeasibilityToolCount = req;
        state.techFeasibilityOutputShown = true;
        state.planSkillTriggered = true;
        state.planToolVerified = true;
        state.planOutputShown = true;
        state.userTriggered = true;
        // executionSkillsLoaded は空のまま → エディット時にスキル促す
        return;
      }

      // status 表示ユーティリティ
      const formatStatus = (s: SessionState) => {
        const req = requiredResearch(s.level);
        const totalTopics = s.techFeasibilityTopicCount + s.techFeasibilityAdditionalTopicCount;
        return [
          `Level: ${s.level}`,
          `Setup: skill ${s.setupSkillTriggered ? '✓' : '✗'} | tool ${s.setupToolVerified ? '✓' : '✗'} | chat ${s.setupOutputShown ? '✓' : '✗'}`,
          `Tech-feasibility: skill ${s.techFeasibilitySkillTriggered ? '✓' : '✗'} | tool ${s.techFeasibilityToolCount}/${req} ${s.techFeasibilityToolVerified ? '✓' : '✗'} | chat ${s.techFeasibilityOutputShown ? '✓' : '✗'}`,
          `Investigation: ${s.techFeasibilityInvestigationCount}/${totalTopics} (websearch/webfetch/context7 calls vs committed topics)`,
          `Plan: skill ${s.planSkillTriggered ? '✓' : '✗'} | tool ${s.planToolVerified ? '✓' : '✗'} | chat ${s.planOutputShown ? '✓' : '✗'}`,
          `Trigger: ${s.userTriggered ? '✓' : '✗'}`,
          `Execution skills: ${s.executionSkillsLoaded.length > 0 ? '✓' : '✗'}`,
        ].join('\n');
      };
      const injectStatus = (s: SessionState) => {
        const messageID = output.message.id;
        if (messageID) {
          output.parts.push({
            type: 'text',
            id: `prt_${crypto.randomUUID()}`,
            sessionID: input.sessionID,
            messageID,
            text: `## Execution Gate Status\n\n${formatStatus(s)}`,
          });
        }
      };

      // state display trigger
      if (STATE_TRIGGER.test(firstLine)) {
        state.lastEvent = 'state display requested';
        injectStatus(state);
        return;
      }

      // level change triggers
      // LV0: 裏コード。トリガーヒット時はメッセージから除去 + 注入 (エージェントには中身を見せない)
      if (LV0_TRIGGERS.test(firstLine)) {
        resetState(input.sessionID);
        const s = getState(input.sessionID);
        s.level = 0;
        s.lastEvent = 'harness released — gate fully bypassed';
        if (textPart.type === 'text') {
          // trigger 行を除去 (multi-line 対応)
          // LV0_TRIGGERS は ^...$ アンカーで文字列全体マッチするため、
          // 単行 split + 該当行 splice + 再 join で multi-line でも動作
          const lines = textPart.text.split('\n');
          const triggerIdx = lines.findIndex((l) => LV0_TRIGGERS.test(l.trim()));
          if (triggerIdx >= 0) {
            lines.splice(triggerIdx, 1);
            textPart.text = lines.join('\n').trim();
          }
        }
        const messageID = output.message.id;
        if (messageID) {
          output.parts.push({
            type: 'text',
            id: `prt_${crypto.randomUUID()}`,
            sessionID: input.sessionID,
            messageID,
            text: '[Harness released. The execution gate is bypassed for this session. Proceed with any tool call.]',
          });
        }
        return;
      }
      // level triggers (LV1/LV2/LV3): state reset + lastEvent 記録 + state push
      // state push は user chat に inject して、user が状態変化を即確認できるようにする
      if (LV1_TRIGGERS.test(firstLine)) {
        resetState(input.sessionID);
        const s = getState(input.sessionID);
        s.level = 1;
        s.lastEvent = 'level change to LV1 (Light) — tech-feasibility/plan not required';
        injectStatus(s);
        return;
      }
      if (LV2_TRIGGERS.test(firstLine)) {
        resetState(input.sessionID);
        const s = getState(input.sessionID);
        s.level = 2;
        s.lastEvent = 'level change to LV2 (Default) — tech-feasibility 1 + plan required';
        injectStatus(s);
        return;
      }
      if (LV3_TRIGGERS.test(firstLine)) {
        resetState(input.sessionID);
        const s = getState(input.sessionID);
        s.level = 3;
        s.lastEvent = 'level change to LV3 (Plan) — tech-feasibility 2 shots + discussion + plan';
        injectStatus(s);
        return;
      }

      // DONE trigger: state reset + lastEvent 記録 + state push
      if (DONE_TRIGGERS.test(firstLine)) {
        resetState(input.sessionID);
        const s = getState(input.sessionID);
        s.lastEvent = 'session done — state reset';
        injectStatus(s);
        return;
      }

      // GO trigger
      if (EXECUTE_TRIGGERS.test(firstLine)) {
        state.userTriggered = true;
        state.lastEvent = 'user trigger GO — gate opened, proceed with implementation';
      }
    },

    // ── tool.execute.after: skill detection + tool verification ───────────
    'tool.execute.after': async (input, output) => {
      if (!input.sessionID) return;
      const state = getState(input.sessionID);

      // スキル発火を検出
      if (input.tool === 'skill') {
        const args = input.args as { name?: string } | undefined;
        const name = args?.name;
        if (!name) return;

        if (name === 'setup') {
          state.setupSkillTriggered = true;
        } else if (name === 'tech-feasibility') {
          state.techFeasibilitySkillTriggered = true;
        } else if (name === 'plan') {
          state.planSkillTriggered = true;
        } else if (EXECUTION_SKILLS.includes(name)) {
          if (!state.executionSkillsLoaded.includes(name)) {
            state.executionSkillsLoaded.push(name);
          }
        }
        return;
      }

      // tech-feasibility ツール呼び出しをカウント
      if (input.tool === 'tech-feasibility') {
        state.techFeasibilityToolCount++;
      }

      // 調査ツール (websearch / webfetch / context7_query-docs) 呼び出しをカウント
      if (isInvestigationTool(input.tool)) {
        state.techFeasibilityInvestigationCount++;
      }

      // カスタムツールの戻り値を検証
      try {
        const result = JSON.parse(output.output);

        if (input.tool === 'setup' && result.type === 'setup') {
          if (result.topic && result.goal && result.gate) {
            state.setupToolVerified = true;
            state.setupData = {
              topic: result.topic,
              goal: result.goal,
              gate: result.gate,
              issue: parseSetupIssue(result.issue),
            };
            state.pendingOutputTool = 'setup';
          }
        }

        if (input.tool === 'tech-feasibility' && result.type === 'tech-feasibility') {
          if (Array.isArray(result.topics) && result.topics.length > 0) {
            state.techFeasibilityToolVerified = true;
            state.techFeasibilityData = {
              topics: result.topics,
            };
            // 1 回目の call: techFeasibilityTopicCount を記録 / 2 回目: additional を記録
            // techFeasibilityToolCount は既に上のブロックで increment 済み
            if (state.techFeasibilityToolCount === 1) {
              state.techFeasibilityTopicCount = result.topics.length;
            } else if (state.techFeasibilityToolCount === 2) {
              state.techFeasibilityAdditionalTopicCount = result.topics.length;
            }
            state.pendingOutputTool = 'tech-feasibility';
          }
        }

        if (input.tool === 'plan' && result.type === 'plan') {
          if (Array.isArray(result.fileChanges) && result.fileChanges.length > 0) {
            state.planToolVerified = true;
            state.planData = {
              fileChanges: result.fileChanges,
            };
            state.pendingOutputTool = 'plan';
          }
        }
      } catch {}
    },

    // ── experimental.text.complete: detect assistant text after tool call ──
    'experimental.text.complete': async (input, _output) => {
      if (!input.sessionID) return;
      const state = getState(input.sessionID);

      // ツール呼び出し後のアシスタントテキスト出力を検出
      if (state.pendingOutputTool) {
        if (state.pendingOutputTool === 'setup') {
          state.setupOutputShown = true;
        } else if (state.pendingOutputTool === 'tech-feasibility') {
          state.techFeasibilityOutputShown = true;
        } else if (state.pendingOutputTool === 'plan') {
          state.planOutputShown = true;
        }
        state.pendingOutputTool = null;
      }
    },

    // ── tool.execute.before: action gate ────────────────────────────────────
    'tool.execute.before': async (input, output) => {
      if (!input.sessionID) return;
      const state = getState(input.sessionID);

      // LV0 (harness release): 全 gate バイパス
      if (state.level === 0) return;

      // execution_gate.ts 自体へのアクセスは LV0 のみ許可 (自己保護)
      if (input.tool === 'edit' || input.tool === 'write' || input.tool === 'patch') {
        const filePath = String((output.args as { filePath?: string } | undefined)?.filePath ?? '');
        if (filePath.endsWith('/plugins/execution_gate.ts')) {
          throw new Error(
            `[execution-gate] Cannot edit '${filePath}' at level ${state.level}. ` +
              `Set level to LV0 (harness release) to modify the gate itself.`,
          );
        }
        // md ファイル (.opencode 配下以外) は gate バイパス
        // ドキュメント作成・更新を自由化 (setup/tech-feasibility/plan/GO/execution skill 不要)
        if (isFreeMarkdownPath(filePath)) {
          return;
        }
      }

      if (isAllowedTool(input.tool)) return;

      // bash: allow read-only commands and external CLI prefixes
      // force-review は gate 通過後に別途チェック
      let bashCommand = '';
      if (input.tool === 'bash') {
        bashCommand = String((output.args as { command?: string } | undefined)?.command ?? '');
        const trimmed = bashCommand.trimStart();
        if (BASH_READONLY.test(trimmed)) {
          return;
        }
        if (/^git\s+/.test(trimmed) && GIT_READONLY.test(trimmed.replace(/^git\s+/, ''))) {
          return;
        }
        if (GH_READONLY.test(trimmed)) {
          return;
        }
        if (GH_SEARCH_READONLY.test(trimmed)) {
          return;
        }
        if (GH_COMPLETION_READONLY.test(trimmed)) {
          return;
        }
        if (GH_READONLY_STANDALONE.test(trimmed)) {
          return;
        }
        if (BASH_EXTERNAL_CLI.test(trimmed)) {
          return;
        }
        // working gh check: gh コマンドで read-only 以外 → user trigger (GO) 必須
        // 専用エラーメッセージで read-only 代替を案内
        if (/^\s*gh\s+/.test(trimmed) && !state.userTriggered) {
          throw new Error(
            `[execution-gate] Working gh command requires the gate to be open: \`${trimmed}\`\n` +
              `- ✗ user trigger required (say 'GO')\n` +
              `- Read-only gh commands (view, list, status, checks, diff) work without the gate.`,
          );
        }
      }

      const missing: string[] = [];

      // 条件1: setup スキル + ツール + チャット出力
      if (!state.setupSkillTriggered) {
        missing.push('- ✗ setup skill not triggered (fire `setup` skill)');
      } else if (!state.setupToolVerified) {
        missing.push('- ✗ setup tool not verified (call `setup` tool with topic, goal, gate)');
      } else if (!state.setupOutputShown) {
        missing.push(
          '- ✗ setup result not shown in chat (write the result to chat after the tool call)',
        );
      }

      // 条件2: tech-feasibility スキル + ツール回数 + ツール検証 + チャット出力 (LV2/LV3のみ)
      if (state.level >= 2) {
        const req = requiredResearch(state.level);
        if (!state.techFeasibilitySkillTriggered) {
          missing.push('- ✗ tech-feasibility skill not triggered (fire `tech-feasibility` skill)');
        } else if (state.techFeasibilityToolCount < req) {
          const remaining = req - state.techFeasibilityToolCount;
          missing.push(
            `- ✗ tech-feasibility tool count: ${state.techFeasibilityToolCount}/${req} (call \`tech-feasibility\` tool ${remaining} more time${remaining === 1 ? '' : 's'})`,
          );
        } else if (!state.techFeasibilityToolVerified) {
          missing.push(
            '- ✗ tech-feasibility tool not verified (call `tech-feasibility` tool with findings)',
          );
        } else if (!state.techFeasibilityOutputShown) {
          missing.push(
            '- ✗ tech-feasibility result not shown in chat (write the result to chat after the tool call)',
          );
        } else {
          // サブ条件: 調査 (websearch/webfetch/context7) を実際に実行したか
          // topic 1 件 = 最低 1 investigation。3 sources 推奨は MD レベルで担保。
          const totalTopics =
            state.techFeasibilityTopicCount + state.techFeasibilityAdditionalTopicCount;
          if (state.techFeasibilityInvestigationCount < totalTopics) {
            const remaining = totalTopics - state.techFeasibilityInvestigationCount;
            missing.push(
              `- ✗ tech-feasibility investigation: ${state.techFeasibilityInvestigationCount}/${totalTopics} topics researched (call websearch/webfetch/context7_query-docs ${remaining} more time${remaining === 1 ? '' : 's'})`,
            );
          }
        }
      }

      // 条件3: plan スキル + ツール + チャット出力 (LV2/LV3のみ)
      if (state.level >= 2) {
        if (!state.planSkillTriggered) {
          missing.push('- ✗ plan skill not triggered (fire `plan` skill)');
        } else if (!state.planToolVerified) {
          missing.push(
            '- ✗ plan tool not verified (call `plan` tool with type, fileChanges; full plan content goes in the MD output)',
          );
        } else if (!state.planOutputShown) {
          missing.push(
            '- ✗ plan result not shown in chat (write the result to chat after the tool call)',
          );
        }
      }

      // 条件4: ユーザートリガー ("GO")
      if (!state.userTriggered) {
        missing.push("- ✗ user trigger required (say 'GO')");
      }

      // 条件5: 実行スキル >= 1
      if (state.executionSkillsLoaded.length === 0) {
        missing.push(
          '- ✗ no execution skill loaded (fire one of: implement, debug, apply-pattern, issue, readme)',
        );
      }

      if (missing.length > 0) {
        throw new Error(
          `[execution-gate] Cannot execute '${input.tool}'. Missing conditions:\n${missing.join('\n')}\n\nAll conditions must be met. Follow the skill → tool order.`,
        );
      }

      // 条件全充足後の最終チェック: git commit 検出時、code-reviewer 呼び出しを強制
      // 同じ staged content の consecutive retry のみ 1 回限りスルー。それ以外はブロック
      if (input.tool === 'bash' && GIT_COMMIT_CHAIN.test(bashCommand)) {
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
          throw new Error(
            '[force-review] Failed to read git diff. Run git add first, then retry.',
            { cause: error },
          );
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
      }
    },
  };
};

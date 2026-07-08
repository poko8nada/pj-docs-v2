// @ts-nocheck
import type { Plugin } from '@opencode-ai/plugin';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { execFileSync } from 'child_process';

// null = 無制限 (opencode / LLM 側に委ねる)
// 数値 = 文字数で機械カット
// 安全マージン込みで 16000 chars (= 4000 tokens 程度)がいったん境界値
const MAX_CONTEXT_CHARS: number | null = 16000;

// グローバル opencode 配下の memory Layer 2 を直接参照
// $XDG_CONFIG_HOME を優先、未設定なら ~/.config にフォールバック
const LAYER_2_PATH = path.join(
  process.env.XDG_CONFIG_HOME ?? path.join(os.homedir(), '.config'),
  'opencode',
  'skills',
  'memory',
  'store',
  'layer-2.md',
);

// ── helpers ───────────────────────────────────────────────────────────────────

function sanitize(text: string): string {
  return text.replace(/\r/g, '').replace(/\t/g, ' ');
}

function readIfExists(filePath: string, max = 500): string {
  if (!fs.existsSync(filePath)) return '';
  try {
    return sanitize(fs.readFileSync(filePath, 'utf-8').slice(0, max));
  } catch {
    return '';
  }
}

// ── GitHub issues ─────────────────────────────────────────────────────────────

function readGithubIssues(worktree: string): string {
  try {
    const stdout = execFileSync(
      'gh',
      ['issue', 'list', '--state', 'open', '--json', 'number,title,labels', '--limit', '5'],
      { cwd: worktree, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] },
    );
    const issues = JSON.parse(stdout);
    if (!Array.isArray(issues) || issues.length === 0) return '';
    return sanitize(
      issues
        .map((i: unknown) => {
          const labels =
            i.labels?.length > 0 ? ` [${i.labels.map((l: unknown) => l.name).join(', ')}]` : '';
          return `- #${i.number} ${i.title}${labels}`;
        })
        .join('\n'),
    );
  } catch {
    return '';
  }
}

function readSpecIssue(worktree: string): { title: string; body: string } | null {
  try {
    const stdout = execFileSync(
      'gh',
      ['issue', 'list', '--state', 'open', '--json', 'number,title,body', '--limit', '10'],
      { cwd: worktree, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] },
    );
    const issues = JSON.parse(stdout);
    if (!Array.isArray(issues)) return null;

    // Find issue with [Spec] prefix in title
    const spec = issues.find(
      (i: unknown) => typeof i.title === 'string' && i.title.startsWith('[Spec]'),
    );
    if (!spec) return null;

    return {
      title: spec.title,
      body: sanitize(spec.body || ''),
    };
  } catch {
    return '';
  }
}

// ── context builders ──────────────────────────────────────────────────────────

const FLOW_DESCRIPTIONS = [
  '## Project protocol',
  '',
  `The project is driven by design → build → refine as one loop.
  - Design is based on the spec issue.
  - Build is based on the design.
  - Refine is performed based on the build.`,
  '',
  `Project phases and states are managed by issues. Especially, "spec" issue is a definition of a project.
  Here is the definition of each phase.

  | phase  | overview                                           |
  | ------ | -------------------------------------------------- |
  | design | Agree on design / project direction                |
  | build  | Implement product                                  |
  | refine | Refactor / polish product                          |
  | chore  | meta / minor modify / others (harness, typo, etc.) |`,
  '',
  '## Session Flow',
  '',
  `Every session starts in **open-discussion.** You CANNOT execute tools (edit, write, bash).
  Your role is to DISCUSS, RESEARCH, and PROPOSE — not to implement.

  To execute tools, ALL of these conditions must be met:
    1. Phase set via user's [setup] command. This is a LITERAL custom command —
       the user types "[setup] design" exactly. Question tool answers do NOT set phase.
    2. Required skills loaded IN ORDER — do not skip:
       design/build/refine → feasibility → prepare → execution skill
       chore → execution skill
    3. User types "[run]" or "[run] all" on a new line. NOT inferred.
       - "[run]" (default) — the agent MUST use the question tool to ask
         scope (which slice/phase of the agreed plan) before execution.
         Execution is limited to the chosen scope; the next [run] continues.
       - "[run] all" — executes the entire plan in one go, up to and
         including verification (typecheck/lint/format). No commits, no pushes.
       - Question tool "yes/no" answers do NOT count as [run].
    4. "STOP" (on its own line) interrupts a running [run all] and closes
       the execution gate. Phase and skills are preserved.

  Phase-specific behavior:
    open_discussion — Discuss freely. Create .md files anywhere outside .opencode/. Manage issues via \`gh\` (Spec/Design/Build/Refine) as long as the \`issue\` skill is triggered and the corresponding template is read. Code implementation requires [setup] design/build/refine/chore.
    design — Build prototype → discuss → expand to full scope → produce design spec (Style Guide, matrices).
    build — PLAN then IMPLEMENT.
    refine — ANALYZE then IMPROVE.
    chore — EXECUTE directly. Minor changes, harness, typos only.

  The agent proposes next steps. The user controls flow with trigger words
  ([run], [run] all, STOP, RESET, STATE).`,
].join('\n');

// 実行ゲートの責務分離を LLM に伝える
// - 読み取り専用ツール: 常に許可
// - .md ファイル (.opencode/ 配下以外): 常に許可 (notes / design docs / spec drafts 用途)
// - bash `gh` (write): issue スキル + テンプレ (フェーズ非依存)
// - bash read-only / gh read-only: 常に許可
// - .opencode/* or non-md の edit/write/patch + その他の working bash: phase + execution skill + [run]
const PHASE_RULES = [
  '## Phase Rules',
  '',
  'The execution gate separates three concerns:',
  '',
  '- **Read-only tools** (read, grep, glob, websearch, webfetch, question, todowrite): always allowed.',
  '- **`.md` files outside `.opencode/`** (edit/write/patch): always allowed in any phase — use freely for notes, design docs, spec drafts.',
  '- **bash `gh` (write)**: gated by `issue` skill trigger + corresponding template read. **Phase-agnostic** — Spec/Design/Build/Refine issues are operable in any phase as long as the gate is satisfied.',
  '- **bash read-only / `gh` read-only** (ls, cat, gh issue list, gh search, etc.): always allowed.',
  '- **`.opencode/*` or non-md files** (edit/write/patch) and **other working bash**: requires phase ≠ open_discussion + execution skill + `[run]`.',
  '',
  '**Phase gates code implementation, not issue management.**',
].join('\n');

function buildAgentsContext(worktree: string): string {
  return readIfExists(path.join(worktree, 'AGENTS.md'), 4000);
}

function buildLayer2Context(_worktree: string): string {
  return readIfExists(LAYER_2_PATH, 2000);
}

function buildSpecContext(worktree: string): string {
  const spec = readSpecIssue(worktree);
  if (spec) {
    return ['## Spec', '', `### ${spec.title}`, '', spec.body].join('\n');
  }

  // No spec found — suggest checking for project documents
  return [
    '## No spec Found',
    '',
    'No spec issue exists yet. Check if there are planning documents in the project',
    '(e.g., README.md, docs/). If so, review them and consider creating a spec',
    'issue to track the product design.',
  ].join('\n');
}

function buildProjectContext(worktree: string): string {
  const sections: string[] = [];

  const issues = readGithubIssues(worktree);
  if (issues) sections.push(['## Open GitHub Issues', '', '```text', issues, '```'].join('\n'));

  return sections.join('\n\n---\n\n');
}

async function buildContext(worktree: string): Promise<string> {
  const sections: string[] = [];

  // 1. AGENTS.md — how to behave
  const agents = buildAgentsContext(worktree);
  if (agents) sections.push(['# AGENTS.md', '', '```text', agents, '```'].join('\n'));

  // 2. Layer 2 — what to know (memory principles)
  const layer2 = buildLayer2Context(worktree);
  if (layer2) sections.push(['# Memory Principles', '', '```text', layer2, '```'].join('\n'));

  // 3. Spec — product design
  const spec = buildSpecContext(worktree);
  if (spec) sections.push(['# Product Design', '', spec].join('\n'));

  // 4. Project Context — current state
  const project = buildProjectContext(worktree);
  if (project) sections.push(['# Project Context', '', project].join('\n'));

  // 5. Flow descriptions — new model (Open discussion + types)
  sections.push(FLOW_DESCRIPTIONS);

  // 6. Phase Rules — 実行ゲートの責務分離
  sections.push(PHASE_RULES);

  const text = sections.join('\n\n---\n\n');
  return MAX_CONTEXT_CHARS === null ? text : text.slice(0, MAX_CONTEXT_CHARS);
}

// ── plugin ────────────────────────────────────────────────────────────────────

// chat.message hook は廃止。inject status の user-visible 表示は不安定 (opencode #885 / #23440)。
// system.transform 経由での LLM 注入のみ残す (agent は context を受け取るが、user chat には出ない)。
export const InjectContextPlugin: Plugin = async ({ client, worktree }) => {
  const contextCache = new Map<string, Promise<string>>();

  const notifyInjection = async (event: string, size: number) => {
    const limitText = MAX_CONTEXT_CHARS === null ? '∞' : String(MAX_CONTEXT_CHARS);
    await client.tui.showToast({
      body: {
        title: 'Context Injected',
        message: `${event} · ${size} / ${limitText} chars`,
        variant: 'info',
        duration: 5000,
      },
    });
  };

  return {
    event: async ({ event }) => {
      if (event.type === 'session.created') {
        const info = event.properties.info;
        if (info.parentID) return; // skip subagent
        const text = await buildContext(worktree);
        contextCache.set(info.id, Promise.resolve(text));
        await notifyInjection('Session created', text.length);
      }
      if (event.type === 'session.compacted') {
        const { sessionID } = event.properties;
        const text = await buildContext(worktree);
        contextCache.set(sessionID, Promise.resolve(text));
        await notifyInjection('Session compacted', text.length);
      }
    },

    'experimental.chat.system.transform': async (input, output) => {
      const { sessionID } = input;
      if (!sessionID) return;

      const ctxPromise = contextCache.get(sessionID);
      if (!ctxPromise) return;

      const ctx = await ctxPromise;
      if (!ctx?.trim()) return;

      output.system.push(ctx);
    },
  };
};

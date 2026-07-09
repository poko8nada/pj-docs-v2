// @ts-nocheck
import type { Plugin } from '@opencode-ai/plugin';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { execFileSync } from 'child_process';

// null = 無制限 (opencode / LLM 側に委ねる)
// 数値 = 文字数で機械カット
// 安全マージン込みで 16000 chars (= 4000 tokens 程度) がいったん境界値
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

// ── static context (harness 固定。ユーザ編集不要) ──────────────────────────────

const FLOW_MD = `## Project protocol

The project is driven by design → build → refine as one loop.

- Design is based on the spec issue.
- Build is based on the design.
- Refine is performed based on the build.

Project phases and states are managed by issues. Especially, the \`[Spec]\` issue is the definition of a project. Here is the definition of each phase.

| phase  | overview                                           |
| ------ | -------------------------------------------------- |
| design | Agree on design / project direction                |
| build  | Implement product                                  |
| refine | Refactor / polish product                          |
| chore  | meta / minor modify / others (harness, typo, etc.) |

## Session Flow

Every session starts in **open-discussion.** You CANNOT execute tools (edit, write, bash). Your role is to DISCUSS, RESEARCH, and PROPOSE — not to implement.

To execute tools, ALL of these conditions must be met:

1. Phase set via user's \`[setup]\` command. This is a LITERAL custom command — the user types \`[setup] design\` exactly. Question tool answers do NOT set phase.
2. Required skills loaded IN ORDER — do not skip:
   - design / build / refine → feasibility → prepare → execution skill
   - chore → execution skill
3. User types \`[run]\` or \`[run] all\` on a new line. NOT inferred.
   - \`[run]\` (default) — the agent MUST use the question tool to ask scope (which slice/phase of the agreed plan) before execution. Execution is limited to the chosen scope; the next \`[run]\` continues.
   - \`[run] all\` — executes the entire plan in one go, up to and including verification (typecheck / lint / format). No commits, no pushes.
   - Question tool "yes/no" answers do NOT count as \`[run]\`.
4. \`STOP\` (on its own line) interrupts a running \`[run] all\` and closes the execution gate. Phase and skills are preserved.

Phase-specific behavior:

- **open_discussion** — Discuss freely. Create \`.md\` files anywhere outside \`.opencode/\`. Manage issues via \`gh\` (Spec / Design / Build / Refine) as long as the \`issue\` skill is triggered and the corresponding template is read. Code implementation requires \`[setup] design / build / refine / chore\`.
- **design** — Build prototype → discuss → expand to full scope → produce design spec (Style Guide, matrices) in the \`[Design]\` issue body.
- **build** — PLAN then IMPLEMENT.
- **refine** — ANALYZE then IMPROVE.
- **chore** — EXECUTE directly. Minor changes, harness, typos only.

The agent proposes next steps. The user controls flow with trigger words (\`[run]\`, \`[run] all\`, \`STOP\`, \`RESET\`, \`STATE\`).
`;

const RULES_MD = `The execution gate separates three concerns:

- **Read-only tools** (read, grep, glob, websearch, webfetch, question, todowrite): always allowed.
- **\`.md\` files outside \`.opencode/\`** (edit / write / patch): always allowed in any phase — use freely for notes, design docs, spec drafts.
- **\`bash gh\` (write)**: gated by \`issue\` skill trigger + corresponding template read. **Phase-agnostic** — Spec / Design / Build / Refine issues are operable in any phase as long as the gate is satisfied.
- **\`bash\` read-only / \`gh\` read-only** (ls, cat, \`gh issue list\`, \`gh search\`, etc.): always allowed.
- **\`.opencode/*\` or non-md files** (edit / write / patch) and **other working \`bash\`**: requires phase ≠ \`open_discussion\` + execution skill + \`[run]\`.

**Phase gates code implementation, not issue management.**
`;

// ── helpers ──────────────────────────────────────────────────────────────────

function sanitize(text: string): string {
  return text.replace(/\r/g, '').replace(/\t/g, ' ');
}

function readIfExists(filePath: string, max?: number): string {
  if (!fs.existsSync(filePath)) return '';
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return sanitize(max ? content.slice(0, max) : content);
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

// ── section schema ───────────────────────────────────────────────────────────
// SECTION_DEFS が injected context の唯一の source of truth。
// - id: stable identifier
// - title: section heading (schema 提供、body には含めない)
// - level: 1 (h1) が top-level、2 (h2) が sub-section
// - codeblock: raw dump 系 (AGENTS.md 等) は ```text``` で囲む
// - source: body を返す関数。動的 (worktree 必要) / 静的 (worktree 不要) 両対応
// 並び順 = 表示順
type SectionDef = {
  id: string;
  title: string;
  level: 1 | 2;
  codeblock?: boolean;
  source: (worktree: string) => string;
};

const SECTION_DEFS: ReadonlyArray<SectionDef> = [
  { id: 'agents', title: 'AGENTS.md', level: 1, codeblock: true, source: readAgents },
  { id: 'memory', title: 'Memory Principles', level: 1, codeblock: true, source: readLayer2 },
  { id: 'spec', title: 'Product Design', level: 1, source: readSpec },
  { id: 'issues', title: 'Open GitHub Issues', level: 2, codeblock: true, source: readIssues },
  { id: 'flow', title: 'Flow descriptions', level: 1, source: () => FLOW_MD },
  { id: 'rules', title: 'Phase Rules', level: 1, source: () => RULES_MD },
];

function renderSection(s: {
  title: string;
  level: 1 | 2;
  body: string;
  codeblock?: boolean;
}): string {
  const heading = '#'.repeat(s.level) + ' ' + s.title;
  const body = s.codeblock ? `\`\`\`text\n${s.body}\n\`\`\`` : s.body;
  return `${heading}\n\n${body}`;
}

function buildContext(worktree: string): string {
  const rendered: string[] = [];
  for (const def of SECTION_DEFS) {
    const body = def.source(worktree);
    if (!body?.trim()) continue;
    rendered.push(renderSection({ ...def, body }));
  }
  const text = rendered.join('\n\n---\n\n');
  return MAX_CONTEXT_CHARS === null ? text : text.slice(0, MAX_CONTEXT_CHARS);
}

// ── section sources ──────────────────────────────────────────────────────────

function readAgents(worktree: string): string {
  return readIfExists(path.join(worktree, 'AGENTS.md'), 4000);
}

function readLayer2(_worktree: string): string {
  return readIfExists(LAYER_2_PATH, 2000);
}

function readSpec(worktree: string): string {
  const spec = readSpecIssue(worktree);
  if (spec) {
    return `### ${spec.title}\n\n${spec.body}`;
  }
  return 'No spec issue exists yet. Check if there are planning documents in the project (e.g., README.md, docs/). If so, review them and consider creating a spec issue to track the product design.';
}

function readIssues(worktree: string): string {
  return readGithubIssues(worktree);
}

// ── plugin ────────────────────────────────────────────────────────────────────

// chat.message hook は廃止。inject status の user-visible 表示は不安定 (opencode #885 / #23440)。
// system.transform 経由での LLM 注入のみ残す (agent は context を受け取るが、user chat には出ない)。

// キャッシュ再構築トリガ: session.created / session.compacted / モデル変更 (3 種)
// 注入する context は 1 種類 (buildContext の出力)。トリガの差で内容は変えない
let lastModelId: string | null = null;

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

  const rebuildContext = async (sessionID: string, label: string) => {
    const text = buildContext(worktree);
    contextCache.set(sessionID, Promise.resolve(text));
    await notifyInjection(label, text.length);
  };

  return {
    event: async ({ event }) => {
      if (event.type === 'session.created') {
        const info = event.properties.info;
        if (info.parentID) return; // skip subagent
        await rebuildContext(info.id, 'Session created');
      }
      if (event.type === 'session.compacted') {
        await rebuildContext(event.properties.sessionID, 'Session compacted');
      }
    },

    'experimental.chat.system.transform': async (input, output) => {
      const { sessionID } = input;
      if (!sessionID) return;

      // モデル変更トリガ: cache 再構築
      const currentModelId = input.model?.id;
      if (currentModelId && currentModelId !== lastModelId) {
        const switched = lastModelId !== null;
        lastModelId = currentModelId;
        if (switched) {
          await rebuildContext(sessionID, 'Model switched');
        }
      }

      const ctxPromise = contextCache.get(sessionID);
      if (!ctxPromise) return;

      const ctx = await ctxPromise;
      if (!ctx?.trim()) return;

      // stateを常に最後尾にするため、アンシフト
      output.system.unshift(ctx);
    },
  };
};

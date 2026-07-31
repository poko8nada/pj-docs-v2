#!/usr/bin/env node
/**
 * sessionStart で Cursor 特有の短い context を additional_context として注入する。
 * 対象: Special rules（Shell / Web）+ Gate rules（いずれも Markdown 構造）。
 * state ファイルはここでは作らない（TTL 掃除のみ）。作成は初回ユーザー発話（beforeSubmitPrompt）。
 * sticky（last-prompt-id）は更新しない — 書き込みは track の beforeSubmitPrompt のみ。
 */
import { logHookIds } from './lib/id-log.mjs';
import { onSessionStart, resolveConversationIdFromPayload, workspaceRoot } from './lib/state.mjs';

// null = 無制限 / 数値 = 文字数で機械カット
const MAX_CONTEXT_CHARS = 16000;

async function readStdinJson() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  const text = Buffer.concat(chunks).toString('utf8').trim();
  if (!text) return {};
  return JSON.parse(text);
}

function respond(payload) {
  process.stdout.write(JSON.stringify(payload) + '\n');
}

/** Cursor 特有（Shell / Web）。この IDE / リポ向けの運用ルール */
function readSpecialRules() {
  return [
    '## Shell',
    '',
    '- cwd is workspace root. Do not `cd` to root or `git -C <workspace-root>`. Subdir `cd` is fine.',
    '- Prefer one logical action per Shell call.',
    '- Related pipes or short chains for one job are fine.',
    '- Do not bundle unrelated steps into one command — use separate Shell calls (parallel when independent).',
    '',
    '## Web',
    '',
    '- Search: MCP `web_search_exa` (on 429 → built-in `WebSearch`).',
    '- Fetch: built-in `WebFetch`.',
    '- Library docs: Context7 first.',
  ].join('\n');
}

/** ゲート要点（詳細は各 skill / deny メッセージ）。ライブ Current values は載せない */
function readGateRules() {
  return [
    '## Phase',
    '',
    '- Default phase is `discussion`.',
    '- On change intent: agree focus, then run the `scope` skill (opens `unlock.scope`). Prose alone does not open the gate.',
    '- `/discussion` closes `unlock.scope`.',
    '- Hands-on: user invokes `/work` or `/chore`. Open `scope` if `unlock.scope` is not true.',
    '- Phase re-entry clears `read.skills` / `read.refs`. `unlock.scope` stays open until `/discussion`.',
    '- Broken harness → user `/bootstrap`.',
    '',
    '## Edits',
    '',
    '- `/work`: need `unlock.scope` → `unlock.agenda` → `unlock.rules` before edits.',
    '- `/chore`: need `unlock.scope` → `unlock.rules` (`unlock.agenda` stays null).',
    '- Issue writes: `/work` + `issue` skill + matching template (`unlock.issue`; template tracked in `read.refs` as `issue/<template>.md`).',
    '',
    '## Mentor',
    '',
    '- `/mentor` — human-centered; reviewable code edits denied.',
    '- `/stub` — unlocks code for that one turn only while mentor is on; no-op if mentor is off.',
    '- `/mentor off` leaves mentor. Does not change phase.',
    '',
    '## References',
    '',
    '- Before gated edits, read at least one `rules/references/*.md` (tracked as `rules/<name>.md` in `read.refs`).',
    '- Any `.cursor/skills/*/references/*.md` Read is recorded as `skill/name.md`.',
    '- Do not edit harness state files by hand.',
    '',
    '## Review',
    '',
    '- `review.files` non-empty → `git commit` blocked.',
    '- Clear with `/pre-commit-reviewer`. Persists across phase changes.',
    '- `md` / `json` / `yaml` are not tracked in `review.files`.',
    '',
    '## State files',
    '',
    '- Live gate state lives under `.cursor/hooks/state/` as `YYYYMMDD-HHmmss+0900__<conversation_id>.json` (hooks-only).',
    '- Set `label` via `node .cursor/skills/scope/scripts/set-label.mjs <label>` (see `scope` skill).',
  ].join('\n');
}

/** SECTION_DEFS が injected context の唯一の source of truth */
function buildSectionDefs() {
  return [
    { id: 'special', title: 'Special rules', level: 2, source: readSpecialRules },
    { id: 'gate-rules', title: 'Gate rules', level: 2, source: readGateRules },
  ];
}

function renderSection(section) {
  const heading = '#'.repeat(section.level) + ' ' + section.title;
  return `${heading}\n\n${section.body}`;
}

function buildContext() {
  const rendered = [];
  for (const def of buildSectionDefs()) {
    const body = def.source();
    if (!body?.trim()) continue;
    rendered.push(renderSection({ ...def, body }));
  }
  const text = rendered.join('\n\n---\n\n');
  return MAX_CONTEXT_CHARS === null ? text : text.slice(0, MAX_CONTEXT_CHARS);
}

async function main() {
  const payload = await readStdinJson();
  logHookIds(payload, 'inject-context');

  // background / subagent 相当はスキップ
  if (payload.is_background_agent === true) {
    return respond({});
  }

  const root = workspaceRoot(payload);
  // inject は sessionStart 専用。id 解決はログ用。sticky は触らない。
  resolveConversationIdFromPayload(payload);
  onSessionStart(root);

  const ctx = buildContext();
  if (!ctx.trim()) return respond({});
  return respond({ additional_context: ctx });
}

main().catch((error) => {
  // sessionStart は fail-open: 注入失敗でもセッション開始は阻まない
  respond({
    user_message: `[inject-context] ${error instanceof Error ? error.message : String(error)}`,
  });
});

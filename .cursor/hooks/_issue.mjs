/**
 * spec / design / forge / refine 入場時の issue ハンドシェイク。
 * issue/SKILL.md Read → issue: true、フェーズテンプレ Read → issueTemplate: true。
 */
import { basename, isAbsolute, relative, resolve, sep } from 'node:path';
import { SPEC_FLOW_PHASES } from './_state.mjs';

export const ISSUE_SKILL_REL = '.cursor/skills/issue/SKILL.md';
const ISSUE_REFS_DIR = '.cursor/skills/issue/references';

const ISSUE_TEMPLATE_NAMES = new Set([
  'spec-template.md',
  'design-app-template.md',
  'design-web-template.md',
  'forge-template.md',
  'refine-template.md',
]);

/** @type {Record<string, string[]>} */
const PHASE_ISSUE_TEMPLATES = {
  spec: ['spec-template.md'],
  design: ['design-app-template.md', 'design-web-template.md'],
  forge: ['forge-template.md'],
  refine: ['refine-template.md'],
};

const GH_ISSUE_READ_SUBS = new Set(['list', 'view', 'status']);

function relPosix(root, filePath) {
  if (!filePath) return null;
  const abs = resolve(isAbsolute(filePath) ? filePath : resolve(root, String(filePath)));
  const rel = relative(root, abs);
  if (!rel || rel.startsWith('..') || rel.includes(`..${sep}`)) return null;
  return rel.split(sep).join('/');
}

/** issue/references 配下の既知テンプレートなら basename */
export function issueTemplateBasename(root, filePath) {
  const posix = relPosix(root, filePath);
  if (!posix || !posix.startsWith(`${ISSUE_REFS_DIR}/`)) return null;
  const name = basename(posix);
  return ISSUE_TEMPLATE_NAMES.has(name) ? name : null;
}

export function issueTemplateValidForPhase(phase, name) {
  const allowed = PHASE_ISSUE_TEMPLATES[phase];
  if (!allowed) return false;
  return allowed.includes(name);
}

export function isSpecFlowPhase(phase) {
  return SPEC_FLOW_PHASES.has(phase);
}

export function isIssueReady(state) {
  if (!isSpecFlowPhase(state?.phase)) return true;
  return state.issue === true && state.issueTemplate === true;
}

export function templateHintForPhase(phase) {
  switch (phase) {
    case 'spec':
      return `\`${ISSUE_REFS_DIR}/spec-template.md\``;
    case 'design':
      return `\`${ISSUE_REFS_DIR}/design-app-template.md\` or \`${ISSUE_REFS_DIR}/design-web-template.md\``;
    case 'forge':
      return `\`${ISSUE_REFS_DIR}/forge-template.md\``;
    case 'refine':
      return `\`${ISSUE_REFS_DIR}/refine-template.md\``;
    default:
      return 'the phase issue template';
  }
}

/** @param {{ phase?: string, issue?: boolean | null, issueTemplate?: boolean }} state */
export function denyIssueMessage(state) {
  if (!isSpecFlowPhase(state?.phase)) return '[gate-issue] unexpected phase';
  if (state.issue !== true) {
    return `[gate-issue] Phase entry requires Read of \`${ISSUE_SKILL_REL}\` first.`;
  }
  return `[gate-issue] Read the phase issue template: ${templateHintForPhase(state.phase)}.`;
}

function stripQuotesAndHeredoc(command) {
  let cleaned = command.replace(/<<-?\s*["']?(\w+)["']?[\s\S]*?\n\s*\1/g, ' ');
  cleaned = cleaned.replace(/(["'])(?:\\.|(?!\1)[^\\])*\1/g, ' ');
  return cleaned;
}

function tokenize(segment) {
  return segment.trim().split(/\s+/).filter(Boolean);
}

function tokensAfterCommand(segment, commandName) {
  const parts = tokenize(segment);
  let i = 0;
  while (
    i < parts.length &&
    (parts[i] === 'sudo' || parts[i] === 'command' || parts[i] === 'time')
  ) {
    i += 1;
  }
  while (i < parts.length && /^[A-Za-z_][A-Za-z0-9_]*=/.test(parts[i])) i += 1;

  let cmd = parts[i] || '';
  if (cmd.includes('/')) cmd = basename(cmd);
  if (cmd.toLowerCase() !== commandName) return [];
  i += 1;

  if (commandName === 'gh') {
    while (i < parts.length) {
      const p = parts[i];
      if (
        p === '--repo' ||
        p === '-R' ||
        p === '--hostname' ||
        p === '--jq' ||
        p === '-q' ||
        p === '--template' ||
        p === '-t'
      ) {
        i += 2;
        continue;
      }
      if (p.startsWith('-')) {
        i += 1;
        continue;
      }
      break;
    }
  }

  return parts.slice(i);
}

function isGhIssueMutationSegment(segment) {
  const args = tokensAfterCommand(segment, 'gh');
  if (args.length === 0) return false;
  if (args[0].toLowerCase() !== 'issue') return false;

  let i = 1;
  while (i < args.length) {
    const p = args[i];
    if (
      p === '--repo' ||
      p === '-R' ||
      p === '--hostname' ||
      p === '--jq' ||
      p === '-q' ||
      p === '--template' ||
      p === '-t'
    ) {
      i += 2;
      continue;
    }
    if (p.startsWith('-')) {
      i += 1;
      continue;
    }
    break;
  }

  const sub = (args[i] || '').toLowerCase();
  if (!sub) return false;
  return !GH_ISSUE_READ_SUBS.has(sub);
}

/** `gh issue create|edit|comment|…` を含むか（read-only list/view/status は除く） */
export function commandIncludesGhIssueMutation(command) {
  const cleaned = stripQuotesAndHeredoc(String(command ?? ''));
  const segments = cleaned
    .split(/&&|\|\||;|\n|\|/)
    .map((s) => s.trim())
    .filter(Boolean);
  return segments.some(isGhIssueMutationSegment);
}

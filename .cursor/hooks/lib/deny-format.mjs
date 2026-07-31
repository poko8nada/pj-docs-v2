/**
 * Agent-facing gate deny text (error-as-directive).
 * Callers supply tag / why / next; BLOCKED + Do not skeleton is shared.
 */

/** @type {string[]} */
export const DEFAULT_DO_NOT = [
  'Retry the same blocked tool call unchanged.',
  'Work around via Shell redirects, alternate Write/StrReplace/Delete, or other tools to change the same paths.',
  'Skip the skill or step named in Next.',
];

/**
 * @param {{
 *   tag: string,
 *   why: string,
 *   next: string[],
 *   doNot?: string[] | null,
 * }} opts
 * `doNot: null` omits the Do not section. Omit `doNot` to use DEFAULT_DO_NOT.
 */
export function formatDeny({ tag, why, next, doNot }) {
  const steps = (Array.isArray(next) ? next : []).filter(Boolean).map((s, i) => `${i + 1}. ${s}`);
  const bans = doNot === null ? [] : Array.isArray(doNot) ? doNot : DEFAULT_DO_NOT;
  const parts = [
    `[${tag}] BLOCKED. Follow Next. Do not work around this deny.`,
    '',
    `Why: ${why}`,
    '',
    'Next:',
    ...(steps.length > 0 ? steps : ['1. Stop and follow the harness Gate rules.']),
  ];
  if (bans.length > 0) {
    parts.push('', 'Do not:', ...bans.map((s) => `- ${s}`));
  }
  return parts.join('\n');
}

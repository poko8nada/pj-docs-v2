import type { Plugin } from '@opencode-ai/plugin';
import * as fs from 'fs';
import * as path from 'path';

// ── rule mapping ─────────────────────────────────────────────────────────────

const EXT_TO_RULE: Array<{ exts: string[]; rule: string }> = [
  { exts: ['.ts', '.tsx', '.js', '.jsx'], rule: 'typescript.mdc' },
  { exts: ['.tsx', '.jsx', '.css', '.html'], rule: 'tailwindCSS.mdc' },
  { exts: ['.md', '.mdx', '.mdc'], rule: 'markdown.mdc' },
];

const TEST_PATTERN = /\.(test|spec)\.(ts|tsx|js|jsx)$/;

function getRulesForFiles(filePaths: string[]): Set<string> {
  const rules = new Set<string>();
  for (const fp of filePaths) {
    const ext = path.extname(fp);
    if (TEST_PATTERN.test(fp)) {
      rules.add('testing.mdc');
    }
    for (const mapping of EXT_TO_RULE) {
      if (mapping.exts.includes(ext)) {
        rules.add(mapping.rule);
      }
    }
  }
  return rules;
}

function loadRule(rulesDir: string, ruleName: string): string | null {
  const rulePath = path.join(rulesDir, ruleName);
  if (!fs.existsSync(rulePath)) return null;
  try {
    return fs.readFileSync(rulePath, 'utf-8').trim();
  } catch {
    return null;
  }
}

// ── plugin ───────────────────────────────────────────────────────────────────

const MAX_LOOPS = 1;

export const RuleInjectPlugin: Plugin = async ({ worktree, client }) => {
  const rulesDir = path.join(worktree, '.opencode', 'rules');

  // sessionID → { editedFiles, loopCount }
  const state = new Map<string, { editedFiles: Set<string>; loopCount: number }>();

  const getState = (sessionID: string) => {
    if (!state.has(sessionID)) {
      state.set(sessionID, { editedFiles: new Set(), loopCount: 0 });
    }
    return state.get(sessionID)!;
  };

  return {
    event: async ({ event }) => {
      // track edited files per session
      if (event.type === 'file.edited') {
        // file.edited doesn't carry sessionID in properties,
        // so we buffer across all active sessions
        for (const s of state.values()) {
          s.editedFiles.add(event.properties.file);
        }
      }

      if (event.type === 'session.created') {
        const sessionID = event.properties.info.id;
        getState(sessionID);
      }

      if (event.type === 'session.idle') {
        const sessionID = event.properties.sessionID;
        const s = getState(sessionID);

        if (s.editedFiles.size === 0) return;
        if (s.loopCount >= MAX_LOOPS) {
          // reset for next task
          s.editedFiles.clear();
          s.loopCount = 0;
          return;
        }

        const ruleNames = getRulesForFiles([...s.editedFiles]);
        if (ruleNames.size === 0) return;

        const loadedRules: string[] = [];
        for (const ruleName of ruleNames) {
          const content = loadRule(rulesDir, ruleName);
          if (content) {
            loadedRules.push(`### ${ruleName}\n\n${content}`);
          }
        }

        if (loadedRules.length === 0) return;

        s.loopCount++;

        const loopNote =
          s.loopCount < MAX_LOOPS
            ? `(Review pass ${s.loopCount}/${MAX_LOOPS})`
            : `(Final review pass ${s.loopCount}/${MAX_LOOPS} — no further passes will run)`;

        const prompt = `
## Rule Review ${loopNote}

You have just edited the following files:
${[...s.editedFiles].map((f) => `- \`${f}\``).join('\n')}

Please review your changes against the rules below and fix any violations.

${loadedRules.join('\n\n---\n\n')}
        `.trim();

        if (s.loopCount >= MAX_LOOPS) {
          s.editedFiles.clear();
          s.loopCount = 0;
        }

        await client.session.prompt({
          path: { id: sessionID },
          body: {
            parts: [{ type: 'text', text: prompt }],
          },
        });
      }
    },
  };
};

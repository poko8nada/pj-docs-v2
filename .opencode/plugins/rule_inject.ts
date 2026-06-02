//@ts-nocheck
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

export const RuleInjectPlugin: Plugin = async ({ worktree }) => {
  const rulesDir = path.join(worktree, '.opencode', 'rules');

  const state = new Map<string, { editedFiles: Set<string> }>();

  const getState = (sessionID: string) => {
    if (!state.has(sessionID)) {
      state.set(sessionID, { editedFiles: new Set() });
    }
    return state.get(sessionID)!;
  };

  return {
    event: async ({ event }) => {
      if (event.type === 'file.edited') {
        for (const s of state.values()) {
          s.editedFiles.add(event.properties.file);
        }
      }

      if (event.type === 'session.created') {
        getState(event.properties.info.id);
      }
    },

    'tool.execute.after': async (input) => {
      if (!['write', 'edit', 'apply_patch'].includes(input.tool)) return;
      const filePath = (input as unkown).args?.filePath ?? (input as unkown).args?.path ?? '';
      if (!filePath) return;
      for (const s of state.values()) {
        s.editedFiles.add(filePath);
      }
    },

    'tool.execute.before': async (input, output) => {
      if (input.tool !== 'bash') return;

      const command: string = output.args?.command ?? '';
      if (!/\bgit commit\b/.test(command)) return;

      const sessionID = (input as unknown).sessionID;
      if (!sessionID) return;

      const s = getState(sessionID);
      if (s.editedFiles.size === 0) return;

      const ruleNames = getRulesForFiles([...s.editedFiles]);
      if (ruleNames.size === 0) {
        s.editedFiles.clear();
        return;
      }

      const loadedRules: string[] = [];
      for (const ruleName of ruleNames) {
        const content = loadRule(rulesDir, ruleName);
        if (content) {
          loadedRules.push(`### ${ruleName}\n\n${content}`);
        }
      }

      if (loadedRules.length === 0) {
        s.editedFiles.clear();
        return;
      }

      const editedFiles = [...s.editedFiles];
      s.editedFiles.clear();

      throw new Error(
        `
[rule-inject] Commit blocked. Review required.

Edited files:
${editedFiles.map((f) => `- \`${f}\``).join('\n')}

Rules to verify:
${loadedRules.join('\n\n---\n\n')}

Instructions:
1. Review your changes against the rules above.
2. Fix any violations.
3. Run git commit again.
      `.trim(),
      );
    },
  };
};

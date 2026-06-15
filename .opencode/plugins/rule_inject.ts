import type { Plugin } from '@opencode-ai/plugin';
import * as fs from 'fs';
import * as path from 'path';

// ── rule mapping ─────────────────────────────────────────────────────────────
// (test edit to verify rule-inject)

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
  const editedFiles = new Set<string>();

  return {
    'tool.execute.after': async (input) => {
      if (!['write', 'edit', 'apply_patch'].includes(input.tool)) return;
      const args = input.args as { filePath?: string; path?: string } | undefined;
      const filePath = args?.filePath ?? args?.path ?? '';
      if (filePath) editedFiles.add(filePath);
    },

    event: async ({ event }) => {
      if (event.type !== 'file.edited') return;
      const file = (event.properties as { file?: string }).file;
      if (file) editedFiles.add(file);
    },

    'tool.execute.before': async (input, output) => {
      if (input.tool !== 'bash') return;
      const command: string = output?.args?.command ?? '';
      if (!/\bgit commit\b/.test(command)) return;

      const touched = [...editedFiles];
      if (touched.length === 0) return;

      const ruleNames = getRulesForFiles(touched);
      if (ruleNames.size === 0) {
        editedFiles.clear();
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
        editedFiles.clear();
        return;
      }

      // First commit attempt: block and clear state.
      // Next commit attempt will see editedFiles.size === 0 and pass.
      editedFiles.clear();

      throw new Error(
        `
[rule-inject] Commit blocked. Review required.

Edited files:
${touched.map((f) => `- \`${f}\``).join('\n')}

Rules to verify:
${loadedRules.join('\n\n---\n\n')}

Instructions:
1. Review your changes against the rules above.
2. Fix any violations.
3. Run git commit again — the second attempt will pass.
      `.trim(),
      );
    },
  };
};

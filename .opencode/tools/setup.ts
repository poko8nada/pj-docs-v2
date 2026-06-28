import { tool } from '@opencode-ai/plugin';

// セッションの Goal と Gate を定義するツール
// 構造化JSONを返し、プラグインが実行ゲートで検証する
// `issue` は discriminated union:
//   - { action: 'reference', number, url }: 既存 issue を参照
//   - { action: 'create' }: 新規 issue 作成がゴール
//   - null / undefined: issue 関連なし
export default tool({
  description:
    'Define session Goal and Gate for the execution gate. Returns structured JSON for plugin verification.',
  args: {
    topic: tool.schema.string().describe('Session topic (e.g. "Header Title Change")'),
    goal: tool.schema.string().describe('What to achieve this session (1 sentence)'),
    gate: tool.schema.string().describe("What 'done' looks like (verifiable, short)"),
    issue: tool.schema
      .discriminatedUnion('action', [
        tool.schema.object({
          action: tool.schema.literal('reference'),
          number: tool.schema.number().describe('GitHub issue number'),
          url: tool.schema.string().describe('GitHub issue URL'),
        }),
        tool.schema.object({
          action: tool.schema.literal('create'),
        }),
      ])
      .nullable()
      .optional()
      .describe(
        'Optional: reference an existing issue, declare intent to create one, or omit/null for no issue',
      ),
    skills: tool.schema
      .array(tool.schema.string())
      .optional()
      .describe(
        'Execution skills the user agreed to in Step 2 (e.g. implement, debug, apply-pattern, issue, readme)',
      ),
  },
  async execute(args) {
    return JSON.stringify({
      type: 'setup',
      topic: args.topic,
      goal: args.goal,
      gate: args.gate,
      issue: args.issue ?? null,
      skills: args.skills ?? null,
      timestamp: Date.now(),
    });
  },
});

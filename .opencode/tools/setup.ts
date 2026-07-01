import { tool } from '@opencode-ai/plugin';

// セッションの goal と type を定義するツール
// 構造化JSONを返し、プラグインが実行ゲートで検証する
// `type` が skill 連鎖を決める
// goal + type のみ。gate / issue / skills などは setup の責務外
export default tool({
  description:
    'Define session goal and type for the execution gate. Returns structured JSON for plugin verification.',
  args: {
    goal: tool.schema.string().describe('What to achieve this session (1 sentence)'),
    type: tool.schema
      .enum(['build', 'design-align', 'issue-ops', 'light'])
      .describe(
        'Session type, agreed with the user during Goal Setting. Determines the skill chain.',
      ),
  },
  async execute(args) {
    return JSON.stringify({
      type: 'setup',
      goal: args.goal,
      sessionType: args.type,
      timestamp: Date.now(),
    });
  },
});

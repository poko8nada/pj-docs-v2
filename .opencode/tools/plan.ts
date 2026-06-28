import { tool } from '@opencode-ai/plugin';

// 実装計画をゲート検証用に提出するツール
// JSON は最小 (type + fileChanges)。全内容は MD でチャットに出力する
// プラグインが実行ゲートで type + fileChanges 配列を検証する
export default tool({
  description:
    'Submit implementation plan for execution gate verification. Minimal JSON (type + fileChanges); full plan content goes in the Markdown output, not here.',
  args: {
    fileChanges: tool.schema
      .array(
        tool.schema.object({
          path: tool.schema.string(),
          type: tool.schema.enum(['new', 'edit', 'delete']),
        }),
      )
      .min(1)
      .describe('File changes for this plan: [{path, type: "new"|"edit"|"delete"}]'),
  },
  async execute(args) {
    return JSON.stringify({
      type: 'plan',
      fileChanges: args.fileChanges,
      timestamp: Date.now(),
    });
  },
});

import { tool } from '@opencode-ai/plugin';

// 研究する topic を実行ゲートに提出するツール
// 1 shot = 1 call。配列で複数 topic をまとめて渡す
// プラグインが実行ゲートで topics 配列の構造と call 数を検証する
export default tool({
  description:
    'Record research topics for execution gate verification. 1 shot = 1 call with a topics array.',
  args: {
    topics: tool.schema
      .array(tool.schema.string().min(1))
      .min(1)
      .describe('Research topics for this shot (1 shot = 1 call, all topics in array)'),
  },
  async execute(args) {
    return JSON.stringify({
      type: 'research',
      topics: args.topics,
      timestamp: Date.now(),
    });
  },
});

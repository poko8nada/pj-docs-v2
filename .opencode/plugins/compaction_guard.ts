import { tool, type Plugin } from '@opencode-ai/plugin';
import { z } from 'zod';

// session ごとの状態（compaction guard 用）
// gate.ts の SessionState と区別するため、CompactionState と命名
// - lastWarnedThreshold: 直近で toast 出した % (0 = 未通知)
// - precompactNote: /precompact で保存されたメモ。次回 compaction prompt に置換注入される
// - currentModel: 直近の LLM 呼び出しで使われた model (context window 取得用)
interface CompactionState {
  lastWarnedThreshold: number;
  precompactNote: string | null;
  currentModel: { limit: { context: number } } | null;
}

const compactionSessions = new Map<string, CompactionState>();

function getOrCreateCompactionState(sessionID: string): CompactionState {
  let s = compactionSessions.get(sessionID);
  if (!s) {
    s = { lastWarnedThreshold: 0, precompactNote: null, currentModel: null };
    compactionSessions.set(sessionID, s);
  }
  return s;
}

// MECE な compaction summary template（日本語）
// opencode 既存の SUMMARY_TEMPLATE を拡張：
// - "重要な詳細" に [REJECTED] タグ付き項目を許容
// - "フェーズ境界" / "セッション状態" を独立セクションとして追加
// - "次のアクション" に「却下アプローチ禁止」を明示
// 注: opencode 本体の SUMMARY_TEMPLATE が変わったら追従する
const MECE_SUMMARY_TEMPLATE = `## 目的
- [ユーザーが達成しようとしていることを 1-2 文で]

## 重要な詳細
- [ADOPTED 採用済み決定と理由、制約/好み、重要な事実/前提、継続に必要な正確な文脈、または "(なし)"]
- [REJECTED 却下したアプローチ（理由付き）— これらは明示的にドロップされたもの、または "(なし)"]

## 作業状態
### 完了
- [完了した作業、検証済みの事実、変更内容、または "(なし)"]

### 進行中
- [現在の作業、部分的な変更、調査状態、または "(なし)"]

### ブロック
- [ブロッカー、失敗したコマンド、不明な点、または "(なし)"]

## フェーズ境界
- [現在のphase (open_discussion / design / build / refine / chore)、ユーザーと合意したハード制約 (例: "デプロイ前に検証", "破壊的操作は確認必須")]

## セッション状態
- [現在のphase、run mode (normal/all および scope 確認待機の有無)、issue スキル残ターン数、次に取るアクション]

## 次のアクション
1. [即座の具体的なアクション — 却下したアプローチは禁止、または "(なし)"]
2. [次のアクション（既知の場合）— 却下したアプローチは禁止、または "(なし)"]

## 関連ファイル
- [ファイルまたはディレクトリのパス: なぜ重要か、または "(なし)"]
`;

// pre-compaction note を保存するカスタムツール
// LLM が compaction 直前に呼ぶ。content は次回 compaction prompt に置換注入される
const precompactSave = tool({
  description:
    '現在のセッション状態をプリコンパクトメモとして保存する。次回 compaction プロンプトがデフォルトから置換され、post-compaction LLM が MECE 構造で内容を保持する。compaction 前に必ず呼ぶこと。',
  args: {
    content: z
      .string()
      .describe(
        '4 セクションの markdown: 採用済み決定、却下したアプローチ、フェーズ境界、セッション状態',
      ),
  },
  execute: async (args, ctx) => {
    const s = getOrCreateCompactionState(ctx.sessionID);
    s.precompactNote = args.content;
    return 'プリコンパクトメモを保存しました。次回 compaction でデフォルトテンプレートを置換します。compaction 後は次のサイクルのために再度 /precompact を実行してください。';
  },
});

export const CompactionGuardPlugin: Plugin = async ({ client }) => {
  return {
    // カスタムツール登録
    tool: {
      precompact_save: precompactSave,
    },

    // イベント処理: token 使用量の監視 + compaction 後の note クリア
    event: async ({ event }) => {
      if (event.type === 'message.updated') {
        const info = event.properties.info;
        // assistant message の tokens.input から context 使用率を出す
        if (info.role === 'assistant' && 'tokens' in info && info.tokens) {
          const s = getOrCreateCompactionState(info.sessionID);
          if (s.currentModel) {
            const pct = (info.tokens.input / s.currentModel.limit.context) * 100;
            const next = Math.floor(pct / 5) * 5;
            // 60% 以降 5% 刻みで warning toast
            if (next >= 60 && next > s.lastWarnedThreshold) {
              s.lastWarnedThreshold = next;
              await client.tui.showToast({
                body: {
                  title: 'Context Usage',
                  message: `Context at ${next}%. Run /precompact if you plan to compact soon.`,
                  variant: 'warning',
                  duration: 8000,
                },
              });
            }
          }
        }
      }
      if (event.type === 'session.compacted') {
        // compaction 完了 → note をクリア（次回 cycle 用にリセット）
        const s = getOrCreateCompactionState(event.properties.sessionID);
        s.precompactNote = null;
      }
    },

    // 現時点の model を compaction state に記録（次以降の message.updated で context window 参照用）
    'experimental.chat.system.transform': async (input) => {
      if (input.sessionID) {
        const s = getOrCreateCompactionState(input.sessionID);
        s.currentModel = input.model as CompactionState['currentModel'];
      }
    },

    // compaction prompt を MECE template に置換（日本語）
    // note の有無に関わらず常に MECE 構造を使う:
    // - note あり: MECE template + note を priority context として注入
    // - note なし: MECE template 単体。LLM に [ADOPTED]/[REJECTED] タグと
    //   「次のアクション」の禁則を明示することで、/precompact 忘れのエッジケースを構造的に mitigation
    'experimental.session.compacting': async (input, output) => {
      const s = compactionSessions.get(input.sessionID);

      if (s?.precompactNote) {
        output.prompt =
          '上記の会話履歴から compaction summary を日本語で生成してください。\n\n' +
          '## CRITICAL: プリコンパクトメモ（verbatim で保持）\n\n' +
          '<note>\n' +
          s.precompactNote +
          '\n</note>\n\n' +
          'メモは 4 セクションを含む。MECE summary テンプレートに統合してください：\n' +
          '- **採用済み決定 (Adopted Decisions)** → "重要な詳細" に [ADOPTED] タグ付きで、理由を保持\n' +
          '- **却下したアプローチ (Rejected Approaches)** → "重要な詳細" に [REJECTED] タグ付きで。' +
          '**CRITICAL: これらは "次のアクション" や将来のアクション セクションに絶対記載しないこと。' +
          '却下したアプローチの再提案は重大な失敗。**\n' +
          '- **フェーズ境界 (Phase Boundaries)** → "フェーズ境界" セクションに（ハード制約）\n' +
          '- **セッション状態 (Session State)** → "セッション状態" セクションに\n\n' +
          MECE_SUMMARY_TEMPLATE;
      } else {
        // note なし: MECE template 単体。/precompact 忘れのエッジケース対応
        output.prompt =
          '上記の会話履歴から compaction summary を日本語で生成してください。\n\n' +
          'プリコンパクトメモは保存されていません。MECE summary テンプレートを使って ' +
          '重要な状態を全てキャプチャしてください。特に以下に注意：\n' +
          '- 採用済み決定には "重要な詳細" で [ADOPTED] タグを付ける（理由を保持）\n' +
          '- 却下したアプローチには "重要な詳細" で [REJECTED] タグを付ける ' +
          '**CRITICAL: これらは "次のアクション" や将来のアクション セクションに絶対記載しないこと。' +
          '却下したアプローチの再提案は重大な失敗。**\n' +
          '- ハード制約は "フェーズ境界" にキャプチャ（例: "デプロイ前に検証"）\n' +
          '- アクティブなコンテキストは "セッション状態" にキャプチャ（issue スキル残ターン数、run mode）\n\n' +
          '次回の compaction では、compaction 前に /precompact を実行することをお勧めします。\n\n' +
          MECE_SUMMARY_TEMPLATE;
      }
    },
  };
};

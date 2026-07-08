---
description: プリコンパクトメモを保存する。次回 compaction プロンプトをデフォルトから MECE 構造に置換し、重要な状態を保持する。
---

セッションを compaction する前に、`precompact_save` ツールを使って重要な状態をキャプチャする。

ツールの `content` パラメータに以下の 4 セクションを埋めて呼び出すこと（**必ず全て埋める**）:

## 1. 採用済み決定 (Adopted Decisions)

このセッションで**実際に実装された**決定のみ記載する。先に決定されたが上書きされたものがある場合、最終版のみを書く。検討のみで reject された代替案は書かない。

## 2. 却下したアプローチ (Rejected Approaches)

却下した各アプローチについて、何を試して、なぜ reject されたか、代わりに何を採用したかを記載。compaction 後の再提案を防ぐために重要。

## 3. フェーズ境界 (Phase Boundaries)

現在のphase (open_discussion / design / build / refine / chore)。ユーザーと合意した明示的な制約（例: 「デプロイ前に検証」「破壊的操作は確認必須」）。現在の run mode。

## 4. セッション状態 (Session State)

- 現在の phase
- run mode (normal / all、scope 確認待機の有無)
- issue スキル残ターン数
- 次に取るアクション（ユーザーと合意済み）

呼び出し: `precompact_save({ content: "<上記 4 セクションの markdown>" })`

`write` は使用しないこと。ツールは note を plugin メモリに保存し、デフォルトの compaction プロンプト テンプレートを 4 セクションを統合する MECE 構造に置換する。

Note: /precompact を呼ばなくても MECE テンプレートは常に使われる（[ADOPTED]/[REJECTED] タグと「次のアクション」の禁則付き）。ただし明示的に /precompact を実行することで、LLM に head start を与え、決定/却下を verbatim でキャプチャできる。

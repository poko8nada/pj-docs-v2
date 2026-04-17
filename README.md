# プロジェクトスターター

新規リポを複製して始めるための土台。依存・TypeScript・品質ツール・Git フック・Cursor 向け設定まで入れてあり、アプリの骨組みは各自で足す前提。

方針（ドキュメントはコード・テスト・Issue を中心にする等）は [`AGENTS.md`](AGENTS.md) と [`.cursor/rules/project-meta.mdc`](.cursor/rules/project-meta.mdc)。

## セットアップ

1. テンプレとしてコピーする。
2. [`package.json`](package.json) の `name` などをプロジェクト用に直す。
3. `pnpm install`（`prepare` で Lefthook が入り、`.cursor/hooks/*.sh` に実行権限が付く）。

## このリポに含まれるもの

- package: [`package.json`](package.json) Hono / HonoX、Vite、Wrangler、Tailwind、Vitest、oxlint / oxfmt
- TS: [`tsconfig.json`](tsconfig.json)
- Git: [`lefthook.yaml`](lefthook.yaml)コミット: format + lint、プッシュ: `tsc --noEmit`
- AI: [`.cursor/`](.cursor/)（ルール・スキル・フック）
- Result型: [`utils/types.ts`](utils/types.ts) の `Result` 型

## このリポに含まれないもの

アプリのエントリ、`vite.config`、`wrangler.toml`、ルーティング・ページなど。ここが未整備だと `pnpm dev` / `pnpm build` / `pnpm preview` / `pnpm deploy` は動かないことがある。

環境変数は `.env` や `.dev.vars`（共有用ファイル名は `.gitignore` の `.env.*` と衝突しないようにする）。

## スクリプト

| コマンド                            | 用途                                           |
| ----------------------------------- | ---------------------------------------------- |
| `pnpm dev`                          | Vite 開発サーバー                              |
| `pnpm dev:remote`                   | `rebuild` のあと `wrangler dev --remote`       |
| `pnpm build`                        | クライアント用ビルドのあと通常ビルド           |
| `pnpm rebuild`                      | `clean` のあと `build`                         |
| `pnpm clean`                        | `.vite` / `dist` / `node_modules/.vite` を削除 |
| `pnpm preview`                      | `wrangler dev`                                 |
| `pnpm deploy`                       | `build` のあと `wrangler deploy`               |
| `pnpm test` / `pnpm test:run`       | Vitest（ウォッチ / 一回）                      |
| `pnpm lint` / `pnpm lint:fix`       | oxlint                                         |
| `pnpm format` / `pnpm format:check` | oxfmt                                          |
| `pnpm typecheck`                    | `tsc --noEmit`                                 |

アプリ未整備でも、現状の TS とツールだけなら `pnpm typecheck`・`pnpm lint`・`pnpm format:check`・（テストファイルがあれば）`pnpm test:run` で確認できる。

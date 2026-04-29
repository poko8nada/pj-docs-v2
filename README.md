# プロジェクトスターター

![Version](https://img.shields.io/badge/version-0.1.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![Status](https://img.shields.io/badge/status-template-lightgrey)
![Node](https://img.shields.io/badge/node-%3E%3D18-brightgreen?logo=node.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue?logo=typescript)
![pnpm](https://img.shields.io/badge/pnpm-managed-F69220?logo=pnpm&logoColor=white)

![GitHub last commit](https://img.shields.io/github/last-commit/poko8nada/pj-docs-v2)
![GitHub issues](https://img.shields.io/github/issues/poko8nada/pj-docs-v2)

## Table of Contents

- [Overview](#overview)
- [Getting Started](#getting-started)
- [Usage](#usage)
- [Configuration](#configuration)
- [Contributing](#contributing)
- [License](#license)
- [Developer Notes](#developer-notes)

## Overview

このリポジトリは [Hono](https://hono.dev/) / [HonoX](https://github.com/honojs/honox) 向けのスターターです。Vite 6・Cloudflare Workers 向けビルド（`@hono/vite-build`）、Tailwind CSS 4、Vitest、oxlint / oxfmt が揃っています。テンプレとして複製し、`app` 配下にルートやコンポーネントを足していく想定です。

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) 18 以上（LTS 推奨）
- [pnpm](https://pnpm.io/)（`package.json` に `packageManager` が無いため、チームでバージョンを揃えると安全）

### Installation

1. テンプレとしてリポジトリを複製するか、GitHub の Use this template でコピーする。
2. [`package.json`](package.json) の `name` などをプロジェクト用に変更する。
3. 依存をインストールする（`prepare` で Lefthook が入り、`.cursor/hooks/*.sh` に実行権限が付く）。

```bash
pnpm install
```

アプリが未整備でも、TypeScript とツールだけなら次で検証できる。

```bash
pnpm typecheck
pnpm lint
pnpm format:check
pnpm test:run
```

## Usage

- `pnpm dev` — Vite 開発サーバー（HonoX の dev）
- `pnpm dev:remote` — `rebuild` のあと `wrangler dev --remote`
- `pnpm build` — クライアント用ビルドのあと Workers 向けビルド
- `pnpm rebuild` — `clean` のあと `build`
- `pnpm clean` — `.vite` / `dist` / `node_modules/.vite` を削除
- `pnpm preview` — `wrangler dev`（ローカル Workers）
- `pnpm deploy` — `build` のあと `wrangler deploy`
- `pnpm test` / `pnpm test:run` — Vitest（ウォッチ / 一回）
- `pnpm lint` / `pnpm lint:fix` — oxlint
- `pnpm format` / `pnpm format:check` — oxfmt
- `pnpm typecheck` — `tsc --noEmit`

## Configuration

- [`.env.example`](.env.example) — アプリ用の環境変数テンプレ。必要なキーをここに列挙し、実値は `.env` などで管理。
- [`.envrc`](.envrc) — [direnv](https://direnv.net/) 用。ローカル専用の `export` を置く。秘密はリポジトリにコミットしない。
- Wrangler — `pnpm deploy` / `preview` を使うときはプロジェクト直下に `wrangler.toml` などを置き、[公式手順](https://developers.cloudflare.com/workers/wrangler/configuration/) に沿ってバインディングや名前を設定する。

## Contributing

- コミット前に Lefthook（format / lint）、プッシュ前に `tsc --noEmit` が走る。
- 方針の大きな変更は Issue か PR 説明で共有するとよい。

## License

MIT。ルートに `LICENSE` を置いた場合はその文面に従う。未配置の場合も README 上で MIT と明記している。

## Developer Notes

### Concept & Goals

- Hono / HonoX で Cloudflare Workers に載るアプリを、短いループで育てる土台にする。
- 仕様書ドリブンな長文ドキュメントは増やさない（必要なら Issue / コード / テストで表現）。

### Stack & Key Decisions

- HTTP / SSR — Hono + HonoX（Workers 向けの軽量スタック、Vite プラグインと一体）
- Build / Dev — Vite 6（client / worker 二段ビルド、`honox` + `@hono/vite-build`）
- Edge — Cloudflare Workers（`wrangler` で preview / deploy、型は `@cloudflare/workers-types`）
- Styling — Tailwind CSS 4（`@tailwindcss/vite` で統合）
- Quality — oxlint / oxfmt（高速 Lint / Format、Lefthook がコミット時に実行）
- Test — Vitest（`--passWithNoTests` でスターター段階でも CI しやすい）
- Editor / AI — `.cursor/rules` ほか（プロジェクト単位のルールとスキル。`AGENTS.md` にエージェント向けの期待を記載）

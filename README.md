# プロジェクトスターター

![Version](https://img.shields.io/badge/version-0.1.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![Status](https://img.shields.io/badge/status-template-lightgrey)
![Node](https://img.shields.io/badge/node-%3E%3D18-brightgreen?logo=node.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue?logo=typescript)
![pnpm](https://img.shields.io/badge/pnpm-managed-F69220?logo=pnpm&logoColor=white)

## Table of Contents

- [Overview](#overview)
- [Getting Started](#getting-started)
- [Usage](#usage)
- [Configuration](#configuration)
- [Contributing](#contributing)
- [License](#license)

## Overview

このリポジトリは Hono / HonoX 向けのスターターです。Vite・Cloudflare Workers 用ツールチェーン、Tailwind、Vitest が入っています。

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) 18 以上（LTS 推奨）
- [pnpm](https://pnpm.io/)（コアパックは `packageManager` 未指定のため、チームでバージョンを揃えると安全）

### Installation

1. テンプレとしてリポジトリを複製または Use this template でコピーする。
2. [`package.json`](package.json) の `name` などをプロジェクト用に変更する。
3. 依存をインストールする（`prepare` で Lefthook が入り、`.cursor/hooks/*.sh` に実行権限が付く）。

```bash
pnpm install
```

アプリが未整備でも、現状の TypeScript とツールだけなら次で検証できる。

```bash
pnpm typecheck
pnpm lint
pnpm format:check
pnpm test:run
```

## Usage

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

## Contributing

- コミット前に Lefthook（format / lint）、プッシュ前に `tsc --noEmit` が走る。
- 大きな方針変更は Issue か PR 説明で共有するとよい。

## License

MIT（リポジトリルートに `LICENSE` を置く場合はその文面に従う。未配置ならプロジェクト側でライセンスを明記すること）。

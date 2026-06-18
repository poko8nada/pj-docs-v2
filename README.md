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

TypeScript ベースのプロジェクトスターターです。oxlint / oxfmt（Lint / Format）、Vitest（Test）、Lefthook（Git hooks）が揃っています。テンプレとして複製し、任意のスタックを追加していく想定です。

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) 18 以上（LTS 推奨）
- [pnpm](https://pnpm.io/)

### Installation

1. テンプレとしてリポジトリを複製するか、GitHub の Use this template でコピーする。
2. [`package.json`](package.json) の `name` などをプロジェクト用に変更する。
3. 依存をインストールする（`prepare` で Lefthook が入る）。

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

- `pnpm build` — `tsc` で TypeScript をコンパイル（出力先: `dist/`）
- `pnpm clean` — `dist/` を削除
- `pnpm test` / `pnpm test:run` — Vitest（ウォッチ / 一回）
- `pnpm lint` / `pnpm lint:fix` — oxlint
- `pnpm format` / `pnpm format:check` — oxfmt
- `pnpm typecheck` — `tsc --noEmit`

## Configuration

- [`.env.example`](.env.example) — アプリ用の環境変数テンプレ。
- [`.envrc`](.envrc) — [direnv](https://direnv.net/) 用。

## Contributing

- コミット前に Lefthook（format / lint）、プッシュ前に `tsc --noEmit` が走る。
- 方針の大きな変更は Issue か PR 説明で共有するとよい。

## License

MIT。

## Developer Notes

### Concept & Goals

- TypeScript を軸に、任意のスタックを載せられる最小限の土台。
- 仕様書ドリブンな長文ドキュメントは増やさない（必要なら Issue / コード / テストで表現）。

### Stack & Key Decisions

- Language — TypeScript 5.9（strict mode, ESNext target）
- Quality — oxlint / oxfmt（高速 Lint / Format、Lefthook がコミット時に実行）
- Test — Vitest（`--passWithNoTests` でスターター段階でも CI しやすい）
- Package Manager — pnpm（workspace mode）
- Editor / AI — `.cursor/rules` ほか（プロジェクト単位のルールとスキル。`AGENTS.md` にエージェント向けの期待を記載）

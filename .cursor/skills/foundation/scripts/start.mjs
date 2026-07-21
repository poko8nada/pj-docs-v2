#!/usr/bin/env node
// foundation ボードを起動するラッパ。プロジェクトルートから実行想定（cd 不要）。
// 依存未インストールなら pnpm install し、Vite を起動し、準備できたら cmux で開く。
// Ctrl-C で Vite ごと終了する。ルートの package.json は触らない（board/ は別物）。
import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { get } from 'node:http';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url)); // .../foundation/scripts
const skillRoot = dirname(here); // .../foundation
const boardDir = join(skillRoot, 'board'); // .../foundation/board
const port = Number(process.env.FOUNDATION_PORT) || 5173;
const url = 'http://127.0.0.1:' + port + '/';

// 1. 依存チェック → 必要なら pnpm install（board 内・--ignore-workspace でルートから隔離）
const nodeModules = join(boardDir, 'node_modules');
if (!existsSync(nodeModules)) {
  process.stderr.write('[foundation] 依存をインストール中...\n');
  const inst = spawnSync('pnpm', ['--ignore-workspace', '--dir', boardDir, 'install'], {
    stdio: 'inherit',
  });
  if (inst.error || inst.status !== 0) {
    process.stderr.write('[foundation] pnpm install に失敗しました\n');
    process.exit(inst.status ?? 1);
  }
}

// 2. Vite 起動（board 内・このラッパの子プロセス）。FOUNDATION_PORT を子にも渡す。
const vite = spawn('pnpm', ['--ignore-workspace', '--dir', boardDir, 'run', 'foundation:dev'], {
  stdio: 'inherit',
  env: { ...process.env, FOUNDATION_PORT: String(port) },
});

// 3. ポート準備待ち → cmux で開く
poll(url, 20000)
  .then(() => spawnSync('cmux', ['browser', 'open', url], { stdio: 'inherit' }))
  .catch(() => process.stderr.write('[foundation] Vite の起動を検知できませんでした\n'));

// 4. Vite が生きている間はこのプロセスも生きる。Ctrl-C で Vite を止める。
// spawn 失敗（pnpm 未インストール等）は即時終了し、poll タイムアウトまで待たない。
vite.on('error', (err) => {
  process.stderr.write('[foundation] Vite の起動に失敗: ' + (err ? err.message : 'unknown') + '\n');
  process.exit(1);
});
vite.on('exit', (code) => process.exit(code ?? 0));
process.on('SIGINT', () => vite.kill('SIGINT'));
process.on('SIGTERM', () => vite.kill('SIGTERM'));

// 指定URLが応答するまでポーリング。
function poll(target, timeoutMs) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const tryOnce = () => {
      get(target, (res) => {
        res.resume();
        resolve();
      }).on('error', () => {
        if (Date.now() - start > timeoutMs) reject(new Error('timeout'));
        else setTimeout(tryOnce, 300);
      });
    };
    tryOnce();
  });
}

#!/usr/bin/env node
// foundation build — chrome 無し Vite build（singlefile）→ findings/foundation/<slug>.html
// 画像など外出し資産は findings/foundation/assets/ へマージ（既存は残す・同名は上書き）。
// 作業場（index.html / comments.json）は変更しない。
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import {
  distDir,
  ensureDeps,
  findingsFoundationDir,
  makeSlug,
  repoRoot,
  workspaceDir,
} from './_paths.mjs';

const IMAGE_EXT = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.webp',
  '.avif',
  '.svg',
  '.ico',
  '.bmp',
]);

ensureDeps();

const build = spawnSync(
  'pnpm',
  ['--ignore-workspace', '--dir', workspaceDir, 'run', 'foundation:build'],
  { stdio: 'inherit' },
);
if (build.error || build.status !== 0) {
  process.stderr.write('[foundation] vite build に失敗しました\n');
  process.exit(build.status ?? 1);
}

const htmlSrc = join(distDir, 'index.html');
if (!existsSync(htmlSrc)) {
  process.stderr.write('[foundation] dist/index.html がありません\n');
  process.exit(1);
}

const slug = makeSlug();
const foundationDir = findingsFoundationDir();
const sharedAssets = join(foundationDir, 'assets');
const htmlOut = join(foundationDir, `${slug}.html`);

mkdirSync(foundationDir, { recursive: true });
mkdirSync(sharedAssets, { recursive: true });
copyFileSync(htmlSrc, htmlOut);

/** dist/assets および dist 直下の画像を共有 assets へマージ（同名上書き・既存は残す）。 */
function mergeImageFiles(srcDir, destDir) {
  if (!existsSync(srcDir)) return;
  for (const name of readdirSync(srcDir)) {
    if (name === 'index.html') continue;
    const src = join(srcDir, name);
    const st = statSync(src);
    if (st.isDirectory()) {
      // dist/assets 配下のサブフォルダだけ辿る（dist 直下の assets ディレクトリ自体は別呼び出し）
      const dest = join(destDir, name);
      mkdirSync(dest, { recursive: true });
      mergeImageFiles(src, dest);
      continue;
    }
    const lower = name.toLowerCase();
    const dot = lower.lastIndexOf('.');
    const ext = dot >= 0 ? lower.slice(dot) : '';
    if (!IMAGE_EXT.has(ext)) continue;
    copyFileSync(src, join(destDir, name));
  }
}

// dist 直下の画像ファイル
if (existsSync(distDir)) {
  for (const name of readdirSync(distDir)) {
    if (name === 'index.html' || name === 'assets') continue;
    const src = join(distDir, name);
    if (!statSync(src).isFile()) continue;
    const lower = name.toLowerCase();
    const dot = lower.lastIndexOf('.');
    const ext = dot >= 0 ? lower.slice(dot) : '';
    if (!IMAGE_EXT.has(ext)) continue;
    copyFileSync(src, join(sharedAssets, name));
  }
}
mergeImageFiles(join(distDir, 'assets'), sharedAssets);

const relHtml = relative(repoRoot(), htmlOut);
process.stdout.write(`[foundation] Path: ${relHtml}\n`);
process.stdout.write(`[foundation] assets (shared): ${relative(repoRoot(), sharedAssets)}/\n`);

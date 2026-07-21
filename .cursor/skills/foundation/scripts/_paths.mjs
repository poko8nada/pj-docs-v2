// foundation スクリプト共通パス。プロジェクトルートから実行想定。
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const here = dirname(fileURLToPath(import.meta.url));
export const skillRoot = dirname(here);
export const workspaceDir = join(skillRoot, 'workspace');
export const defaultsDir = join(skillRoot, 'defaults');
export const commentsFile = join(workspaceDir, 'comments.json');
export const distDir = join(workspaceDir, 'dist');

/** リポジトリルート（.cursor の親）を推定する。 */
export function repoRoot() {
  return dirname(dirname(dirname(skillRoot)));
}

export function findingsFoundationDir() {
  return join(repoRoot(), 'findings', 'foundation');
}

/** 依存が無ければ workspace に pnpm install する。 */
export function ensureDeps() {
  const nodeModules = join(workspaceDir, 'node_modules');
  if (existsSync(nodeModules)) return;
  process.stderr.write('[foundation] 依存をインストール中...\n');
  const inst = spawnSync('pnpm', ['--ignore-workspace', '--dir', workspaceDir, 'install'], {
    stdio: 'inherit',
  });
  if (inst.error || inst.status !== 0) {
    process.stderr.write('[foundation] pnpm install に失敗しました\n');
    process.exit(inst.status ?? 1);
  }
}

/** ローカル日時ベースの slug。FOUNDATION_SLUG があればそれを使う。 */
export function makeSlug() {
  if (process.env.FOUNDATION_SLUG) return process.env.FOUNDATION_SLUG;
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return (
    `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}` +
    `-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`
  );
}

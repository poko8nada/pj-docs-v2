// foundation スクリプト共通パス。プロジェクトルートから実行想定。
import { existsSync, readdirSync, rmSync } from 'node:fs';
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

/** findings/foundation に成果 HTML があるか（初回判定の根拠）。 */
function hasFoundationFindings() {
  const dir = findingsFoundationDir();
  if (!existsSync(dir)) return false;
  return readdirSync(dir).some((name) => name.endsWith('.html'));
}

/** workspace で pnpm install する。失敗したら process.exit。 */
function pnpmInstall() {
  const inst = spawnSync('pnpm', ['--ignore-workspace', '--dir', workspaceDir, 'install'], {
    stdio: 'inherit',
  });
  if (inst.error || inst.status !== 0) {
    process.stderr.write('[foundation] pnpm install に失敗しました\n');
    process.exit(inst.status ?? 1);
  }
}

/**
 * workspace 依存を用意する。
 * findings 未作成（成果 HTML 無し）の初回は node_modules と lock を消して入れ直す。
 * それ以外は node_modules が無ければ install するだけ。
 */
export function ensureDeps() {
  const nodeModules = join(workspaceDir, 'node_modules');
  const lockFile = join(workspaceDir, 'pnpm-lock.yaml');

  if (!hasFoundationFindings()) {
    process.stderr.write('[foundation] findings 未作成のため依存を入れ直します...\n');
    if (existsSync(nodeModules)) rmSync(nodeModules, { recursive: true, force: true });
    if (existsSync(lockFile)) rmSync(lockFile, { force: true });
    pnpmInstall();
    return;
  }

  if (existsSync(nodeModules)) return;
  process.stderr.write('[foundation] 依存をインストール中...\n');
  pnpmInstall();
}

/** 日時スラッグ用に 0 埋めする。 */
function pad2(n) {
  return String(n).padStart(2, '0');
}

/** ローカル日時ベースの slug。FOUNDATION_SLUG があればそれを使う。 */
export function makeSlug() {
  if (process.env.FOUNDATION_SLUG) return process.env.FOUNDATION_SLUG;
  const d = new Date();
  return (
    `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}` +
    `-${pad2(d.getHours())}${pad2(d.getMinutes())}${pad2(d.getSeconds())}`
  );
}

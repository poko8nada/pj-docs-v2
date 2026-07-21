#!/usr/bin/env node
// foundation reset — 作業場をデフォルトに戻す。findings は消さない。
// comments.json と workspace/dist を消し、index.html を defaults から復元する。
import { copyFileSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { commentsFile, defaultsDir, distDir, workspaceDir } from './_paths.mjs';

const defaultIndex = join(defaultsDir, 'index.html');
const workspaceIndex = join(workspaceDir, 'index.html');

if (!existsSync(defaultIndex)) {
  process.stderr.write('[foundation] defaults/index.html がありません\n');
  process.exit(1);
}

copyFileSync(defaultIndex, workspaceIndex);

if (existsSync(commentsFile)) rmSync(commentsFile);
if (existsSync(distDir)) rmSync(distDir, { recursive: true, force: true });

process.stdout.write('[foundation] workspace reset to defaults (findings untouched)\n');

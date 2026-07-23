/**
 * ゲート非常口（bootstrap）— state とは別のマーカーファイルのみ。
 * オン: ユーザー `/bootstrap`（track.mjs）または CURSOR_GATE_BOOTSTRAP=1
 * オフ: `/bootstrap off` または sessionEnd
 */
import { existsSync, unlinkSync, writeFileSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';

export function bootstrapMarkerPath(root) {
  return resolve(root, '.cursor/hooks/.bootstrap');
}

export function isBootstrapActive(root) {
  if (process.env.CURSOR_GATE_BOOTSTRAP === '1') return true;
  return existsSync(bootstrapMarkerPath(root));
}

export function enableBootstrap(root) {
  writeFileSync(bootstrapMarkerPath(root), '', 'utf8');
}

export function disableBootstrap(root) {
  try {
    unlinkSync(bootstrapMarkerPath(root));
  } catch {
    // 無ければ無視
  }
}

/** エージェントの Write/Shell からマーカーを触らせない */
export function isBootstrapMarkerPath(root, filePath) {
  if (!filePath) return false;
  const abs = resolve(isAbsolute(filePath) ? filePath : resolve(root, filePath));
  return abs === bootstrapMarkerPath(root);
}

/** Shell がマーカーへ書き込む／削除しようとしているか */
export function isShellWriteToBootstrapMarker(root, command) {
  const cmd = String(command ?? '');
  const marker = bootstrapMarkerPath(root);
  if (cmd.includes('.cursor/hooks/.bootstrap') || cmd.includes(marker)) {
    if (/\b(rm|mv|cp|tee|truncate|touch)\b/.test(cmd)) return true;
    const re = /(?:^|[\s;|&])(?:\d*)>{1,2}\s*([^\s;|&]+)/g;
    let m;
    while ((m = re.exec(cmd)) !== null) {
      const target = m[1];
      if (target === '/dev/null') continue;
      if (target.includes('.cursor/hooks/.bootstrap') || target.includes(marker)) return true;
    }
  }
  return false;
}

/**
 * gate deny 時の通知音（Funk）。ask（Ping）のあとに続く想定で少し遅らせる。
 * hook は起動ごとに別プロセスなので、debounce は tmp のタイムスタンプで共有する。
 */
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const SOUND = '/System/Library/Sounds/Funk.aiff';
const DELAY_MS = 200;
const DEBOUNCE_MS = 1500;
const STAMP_PATH = join(tmpdir(), 'pj-docs-v2-gate-deny-sound');

function shouldPlay() {
  const now = Date.now();
  try {
    const prev = Number(readFileSync(STAMP_PATH, 'utf8'));
    if (Number.isFinite(prev) && now - prev < DEBOUNCE_MS) return false;
  } catch {
    // 初回 or 読めない → 鳴らす
  }
  try {
    writeFileSync(STAMP_PATH, String(now), 'utf8');
  } catch {
    // stamp 失敗でも音は試みる
  }
  return true;
}

/** gate deny 応答の直前／直後に呼ぶ。fail-open。 */
export function playDenySound() {
  if (!shouldPlay()) return;
  try {
    setTimeout(() => {
      try {
        const child = spawn('afplay', ['-v', '2', SOUND], {
          detached: true,
          stdio: 'ignore',
        });
        child.unref();
      } catch {
        // fail-open
      }
    }, DELAY_MS).unref?.();
  } catch {
    // fail-open
  }
}

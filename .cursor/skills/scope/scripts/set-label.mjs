#!/usr/bin/env node
/**
 * 会話 state の label だけを書き換える（hooks は import しない）。
 * 使い方: node .cursor/skills/scope/scripts/set-label.mjs <label>
 *
 * id は CURSOR_CONVERSATION_ID。gate はこのコマンドをどのフェーズでも allow する。
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const PROJECT_ROOT = resolve(fileURLToPath(new URL('../../../..', import.meta.url)));
const STATE_DIR = join(PROJECT_ROOT, '.cursor', 'hooks', 'state');
const LABEL_RE = /^[a-zA-Z0-9._-]+$/;

function normalizeLabel(label) {
  const s = String(label ?? '').trim();
  if (!s || s.length > 64 || !LABEL_RE.test(s)) return null;
  return s;
}

function conversationId() {
  const id = process.env.CURSOR_CONVERSATION_ID;
  if (!id || id === 'unknown') return null;
  return String(id);
}

function sanitizeId(id) {
  return String(id).replace(/[^a-zA-Z0-9._-]+/g, '_') || 'unknown';
}

/** hooks と同じ: `YYYYMMDD-HHmmss+0900__<id>.json` のうち辞書順末尾 */
function findStatePath(id) {
  if (!existsSync(STATE_DIR)) return null;
  const suffix = `__${sanitizeId(id)}.json`;
  const matches = readdirSync(STATE_DIR)
    .filter((n) => n.endsWith(suffix))
    .toSorted();
  if (matches.length === 0) return null;
  return join(STATE_DIR, matches[matches.length - 1]);
}

function formatJstIso(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const get = (t) => parts.find((p) => p.type === t)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}:${get('second')}+09:00`;
}

function main() {
  const rawLabel = process.argv[2];
  if (!rawLabel) {
    process.stderr.write('usage: node .cursor/skills/scope/scripts/set-label.mjs <label>\n');
    process.exit(2);
  }

  const label = normalizeLabel(rawLabel);
  if (!label) {
    process.stderr.write(
      `invalid label ${JSON.stringify(rawLabel)} (use 1-64 chars: letters, digits, . _ -)\n`,
    );
    process.exit(1);
  }

  const id = conversationId();
  if (!id) {
    process.stderr.write('CURSOR_CONVERSATION_ID is missing; cannot set label\n');
    process.exit(1);
  }

  const path = findStatePath(id);
  if (!path) {
    process.stderr.write(
      `no gate state file for conversation ${id}; send a prompt first so state is created\n`,
    );
    process.exit(1);
  }

  /** @type {Record<string, unknown>} */
  let raw;
  try {
    raw = JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    process.stderr.write(`failed to parse state file: ${path}\n`);
    process.exit(1);
  }

  raw.label = label;
  raw.updatedAt = formatJstIso();
  writeFileSync(path, `${JSON.stringify(raw, null, 2)}\n`, 'utf8');

  process.stdout.write(
    `${JSON.stringify({ ok: true, id, label, phase: raw.phase ?? null, file: path }, null, 2)}\n`,
  );
}

main();

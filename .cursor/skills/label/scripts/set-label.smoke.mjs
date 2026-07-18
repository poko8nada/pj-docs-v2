#!/usr/bin/env node
/**
 * set-label.mjs の smoke（hooks は import しない）。
 * 使い方: node .cursor/skills/label/scripts/set-label.smoke.mjs
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SCRIPT = join(HERE, 'set-label.mjs');
const PROJECT_ROOT = resolve(HERE, '../../../..');
const STATE_DIR = join(PROJECT_ROOT, '.cursor', 'hooks', 'state');
const SMOKE_ID = 'smoke-set-label-test';
const STATE_FILE = join(STATE_DIR, `20260101-000000+0900__${SMOKE_ID}.json`);

let failed = 0;

function assert(name, cond, detail = '') {
  if (!cond) {
    process.stderr.write(`FAIL ${name}${detail ? `: ${detail}` : ''}\n`);
    failed += 1;
  } else {
    process.stdout.write(`ok  - ${name}\n`);
  }
}

function run(args, envOverrides = {}, unsetKeys = []) {
  const env = { ...process.env, ...envOverrides };
  for (const k of unsetKeys) delete env[k];
  return spawnSync(process.execPath, [SCRIPT, ...args], {
    cwd: PROJECT_ROOT,
    encoding: 'utf8',
    env,
  });
}

function writeMinimalState(extra = {}) {
  mkdirSync(STATE_DIR, { recursive: true });
  writeFileSync(
    STATE_FILE,
    `${JSON.stringify(
      {
        phase: 'discussion',
        implement: null,
        label: '',
        updatedAt: '2026-01-01T00:00:00+09:00',
        ...extra,
      },
      null,
      2,
    )}\n`,
    'utf8',
  );
}

function cleanup() {
  if (existsSync(STATE_FILE)) rmSync(STATE_FILE);
}

cleanup();

{
  const r = run([]);
  assert('usage exit 2', r.status === 2, `status=${r.status}`);
}

{
  const r = run(['bad label!'], { CURSOR_CONVERSATION_ID: SMOKE_ID });
  assert('invalid label exit 1', r.status === 1, `status=${r.status}`);
  assert('invalid label message', /invalid label/.test(r.stderr), r.stderr);
}

{
  const r = run(['ok-label'], {}, ['CURSOR_CONVERSATION_ID']);
  assert('missing id exit 1', r.status === 1, `status=${r.status}`);
  assert('missing id message', /CURSOR_CONVERSATION_ID/.test(r.stderr), r.stderr);
}

{
  cleanup();
  const r = run(['ok-label'], { CURSOR_CONVERSATION_ID: SMOKE_ID });
  assert('no state file exit 1', r.status === 1, `status=${r.status}`);
  assert('no state file message', /no gate state file/.test(r.stderr), r.stderr);
}

{
  writeMinimalState({ label: 'old' });
  const r = run(['topic-a'], { CURSOR_CONVERSATION_ID: SMOKE_ID });
  assert('write exit 0', r.status === 0, `status=${r.status} stderr=${r.stderr}`);
  const raw = JSON.parse(readFileSync(STATE_FILE, 'utf8'));
  assert('label written', raw.label === 'topic-a', JSON.stringify(raw.label));
  assert('phase preserved', raw.phase === 'discussion', JSON.stringify(raw.phase));
  assert('updatedAt changed', raw.updatedAt !== '2026-01-01T00:00:00+09:00', raw.updatedAt);
  assert('stdout ok', /"ok":\s*true/.test(r.stdout), r.stdout);
  cleanup();
}

if (failed > 0) {
  cleanup();
  process.exit(1);
}
process.stdout.write('all passed\n');

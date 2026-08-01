#!/usr/bin/env node

import assert from 'node:assert/strict';

import {
  SECRET_NAME,
  hasSecretName,
  main,
  parseSecretNames,
  readApiKey,
} from './setup-pr-agent-secret.mjs';

assert.deepEqual(parseSecretNames('A\n\n B \r\n'), ['A', 'B']);
assert.equal(hasSecretName(`${SECRET_NAME}\nOTHER_SECRET`), true);
assert.equal(hasSecretName('OTHER_SECRET'), false);
assert.equal(readApiKey({ [SECRET_NAME]: '  test-key  ' }), 'test-key');
assert.throws(() => readApiKey({}), new RegExp(`${SECRET_NAME} is not set`));

// 実際のghを呼ばず、引数とstdinだけを検証する。
const calls = [];
let registered = false;
const logs = [];
const errors = [];
const fakeGh = (args, options = {}) => {
  calls.push({ args, options });

  if (args[0] === 'repo') {
    return 'owner/repository';
  }

  if (args[0] === 'secret' && args[1] === 'list') {
    return registered ? `${SECRET_NAME}\n` : '';
  }

  if (args[0] === 'secret' && args[1] === 'set') {
    assert.equal(options.input, 'test-key\n');
    registered = true;
    return '';
  }

  throw new Error(`Unexpected gh command: ${args.join(' ')}`);
};

assert.equal(
  main({
    env: { [SECRET_NAME]: ' test-key ' },
    runGhCommand: fakeGh,
    log: (message) => logs.push(message),
    error: (message) => errors.push(message),
  }),
  0,
);
assert.equal(errors.length, 0);
assert.equal(calls.filter(({ args }) => args[0] === 'secret' && args[1] === 'list').length, 2);
assert.equal(
  calls.some(
    ({ args }) =>
      args[0] === 'secret' &&
      args[1] === 'set' &&
      args.includes(SECRET_NAME) &&
      args.includes('--repo') &&
      args.includes('owner/repository'),
  ),
  true,
);
assert.equal(logs.join('\n').includes('test-key'), false);

const checkLogs = [];
assert.equal(
  main({
    argv: ['--check'],
    runGhCommand: (args) => {
      if (args[0] === 'repo') {
        return 'owner/repository';
      }
      return `${SECRET_NAME}\n`;
    },
    log: (message) => checkLogs.push(message),
    error: (message) => errors.push(message),
  }),
  0,
);
assert.equal(checkLogs.join('\n').includes(SECRET_NAME), true);

const absentCheckLogs = [];
assert.equal(
  main({
    argv: ['--check'],
    runGhCommand: (args) => (args[0] === 'repo' ? 'owner/repository' : ''),
    log: (message) => absentCheckLogs.push(message),
    error: (message) => errors.push(message),
  }),
  2,
);
assert.equal(absentCheckLogs.join('\n').includes('not present'), true);

const unknownArgumentErrors = [];
assert.equal(
  main({
    argv: ['--unexpected'],
    error: (message) => unknownArgumentErrors.push(message),
  }),
  1,
);
assert.equal(unknownArgumentErrors.join('\n').includes('Unknown argument'), true);

const verificationErrors = [];
assert.equal(
  main({
    env: { [SECRET_NAME]: 'test-key' },
    runGhCommand: (args) => (args[0] === 'repo' ? 'owner/repository' : ''),
    error: (message) => verificationErrors.push(message),
  }),
  1,
);
assert.equal(verificationErrors.join('\n').includes('not found afterward'), true);

const ghErrors = [];
assert.equal(
  main({
    runGhCommand: () => {
      throw new Error('gh unavailable');
    },
    error: (message) => ghErrors.push(message),
  }),
  1,
);
assert.equal(ghErrors.join('\n').includes('gh unavailable'), true);

console.log('setup-pr-agent-secret smoke: PASS');

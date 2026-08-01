#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const SECRET_NAME = 'OPENROUTER_API_KEY';

export function readApiKey(env = process.env) {
  // 現在のシェルから読み取るだけで、ファイルへ書き出さない。
  const apiKey = env[SECRET_NAME]?.trim();
  if (!apiKey) {
    throw new Error(`${SECRET_NAME} is not set. Export it in the current shell and retry.`);
  }
  return apiKey;
}

export function parseSecretNames(output) {
  return output
    .split(/\r?\n/)
    .map((name) => name.trim())
    .filter(Boolean);
}

export function hasSecretName(output, secretName = SECRET_NAME) {
  // secret listは値を返さず、名前だけを確認する。
  return parseSecretNames(output).includes(secretName);
}

export function buildRepositoryArgs() {
  return ['repo', 'view', '--json', 'nameWithOwner', '--jq', '.nameWithOwner'];
}

export function buildSecretListArgs(repository) {
  return ['secret', 'list', '--repo', repository, '--json', 'name', '--jq', '.[].name'];
}

export function buildSecretSetArgs(repository) {
  return ['secret', 'set', SECRET_NAME, '--repo', repository];
}

export function runGh(args, options = {}) {
  const result = spawnSync('gh', args, {
    encoding: 'utf8',
    input: options.input,
  });

  if (result.error) {
    throw new Error(`Could not run gh: ${result.error.message}`);
  }

  if (result.status !== 0) {
    const detail = result.stderr?.trim();
    throw new Error(detail || `gh ${args.join(' ')} exited with status ${result.status}`);
  }

  return result.stdout.trim();
}

export function main({
  argv = process.argv.slice(2),
  env = process.env,
  runGhCommand = runGh,
  log = console.log,
  error = console.error,
} = {}) {
  try {
    const helpRequested = argv.includes('--help') || argv.includes('-h');
    const checkOnly = argv.includes('--check');
    const unknownArguments = argv.filter(
      (argument) => !['--check', '--help', '-h'].includes(argument),
    );

    if (unknownArguments.length > 0) {
      throw new Error(`Unknown argument: ${unknownArguments[0]}`);
    }

    if (helpRequested) {
      log(
        [
          'Usage:',
          '  node setup-pr-agent-secret.mjs --check',
          '  node setup-pr-agent-secret.mjs',
        ].join('\n'),
      );
      return 0;
    }

    const repository = runGhCommand(buildRepositoryArgs());
    const listArgs = buildSecretListArgs(repository);
    const currentSecrets = runGhCommand(listArgs);

    if (checkOnly) {
      if (hasSecretName(currentSecrets)) {
        log(`Secret ${SECRET_NAME} is present for ${repository}.`);
        return 0;
      }

      log(`Secret ${SECRET_NAME} is not present for ${repository}.`);
      return 2;
    }

    const apiKey = readApiKey(env);
    // 秘密値はstdinでghへ渡し、argvやログに含めない。
    runGhCommand(buildSecretSetArgs(repository), {
      input: `${apiKey}\n`,
    });

    const registeredSecrets = runGhCommand(listArgs);
    if (!hasSecretName(registeredSecrets)) {
      throw new Error(`gh reported success, but ${SECRET_NAME} was not found afterward.`);
    }

    log(`Secret ${SECRET_NAME} was registered for ${repository}.`);
    return 0;
  } catch (caughtError) {
    error(
      `PR-Agent secret setup failed: ${
        caughtError instanceof Error ? caughtError.message : String(caughtError)
      }`,
    );
    return 1;
  }
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : '';
if (invokedPath === fileURLToPath(import.meta.url)) {
  process.exitCode = main();
}

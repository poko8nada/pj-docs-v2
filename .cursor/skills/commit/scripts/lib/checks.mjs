import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runGit } from './snapshot.mjs';

const CHECKS = Object.freeze([
  {
    name: 'format',
    script: 'format:check',
    extensions: ['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs', '.md', '.mdx', '.json', '.jsonc'],
  },
  {
    name: 'lint',
    script: 'lint',
    extensions: ['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs'],
  },
  {
    name: 'typecheck',
    script: 'typecheck:staged',
    extensions: ['.ts', '.tsx'],
  },
]);

// staged indexを一時workspaceへ展開し、作業ツリーの未staged内容を品質チェックへ混ぜない。
export function runLocalChecks(root, stagedPaths, { runCommand = spawnCommand } = {}) {
  const paths = stagedPaths.map((path) => String(path));
  const relevantChecks = CHECKS.filter(({ extensions }) =>
    paths.some((path) => extensions.some((extension) => path.toLowerCase().endsWith(extension))),
  );
  if (relevantChecks.length === 0) {
    return {
      ok: true,
      checks: CHECKS.map((check) => skippedCheck(check, 'No staged path matches this check.')),
    };
  }

  let workspace;
  try {
    workspace = createCandidateWorkspace(root);
    const packageInfo = readPackageScripts(workspace);
    if (!packageInfo.ok) {
      if (!packageInfo.missing) {
        const checks = CHECKS.map((check) =>
          relevantChecks.includes(check)
            ? failedCheck(check, [packageInfo.reason], [], null)
            : skippedCheck(check, 'No staged path matches this check.'),
        );
        return { ok: false, checks };
      }
      return {
        ok: true,
        checks: CHECKS.map((check) =>
          relevantChecks.includes(check)
            ? skippedCheck(check, packageInfo.reason)
            : skippedCheck(check, 'No staged path matches this check.'),
        ),
      };
    }

    const checks = CHECKS.map((check) => {
      if (!relevantChecks.includes(check))
        return skippedCheck(check, 'No staged path matches this check.');
      const checkPaths = paths.filter((path) =>
        check.extensions.some((extension) => path.toLowerCase().endsWith(extension)),
      );
      if (typeof packageInfo.scripts[check.script] !== 'string') {
        return failedCheck(check, [`Missing package script: ${check.script}`], [], 1, checkPaths);
      }
      return runCheck(
        root,
        workspace,
        check,
        checkPaths,
        packageInfo.scripts[check.script],
        runCommand,
      );
    });
    return { ok: checks.every((check) => check.status !== 'failed'), checks };
  } catch (error) {
    const checks = CHECKS.map((check) =>
      relevantChecks.includes(check)
        ? failedCheck(check, [errorMessage(error)], [])
        : skippedCheck(check, 'No staged path matches this check.'),
    );
    return { ok: false, checks };
  } finally {
    if (workspace) rmSync(workspace, { recursive: true, force: true });
  }
}

// 現在のindexだけを検査対象にするため、tracked内容を一時ディレクトリへ展開する。
function createCandidateWorkspace(root) {
  const workspace = mkdtempSync(join(tmpdir(), 'commit-review-check-'));
  const checkout = runGit(root, ['checkout-index', '--all', `--prefix=${workspace}/`]);
  if (!checkout.ok) {
    rmSync(workspace, { recursive: true, force: true });
    throw new Error(checkout.message);
  }

  return workspace;
}

// staged candidateのpackage scriptを読み、fixtureなど実行環境がない場合は安全にskipする。
function readPackageScripts(workspace) {
  const packagePath = join(workspace, 'package.json');
  if (!existsSync(packagePath)) {
    return {
      ok: false,
      missing: true,
      reason: 'No package.json exists in the staged candidate.',
    };
  }
  try {
    const packageJson = JSON.parse(readFileSync(packagePath, 'utf8'));
    return { ok: true, scripts: packageJson.scripts ?? {} };
  } catch (error) {
    return {
      ok: false,
      missing: false,
      reason: `Could not read package.json: ${errorMessage(error)}`,
    };
  }
}

// 1つのcheckを実行し、終了コードだけでなくwarningもreview停止条件として記録する。
function runCheck(root, workspace, check, paths, script, runCommand) {
  const env = { ...process.env };
  delete env.GIT_INDEX_FILE;
  const binPath = join(root, 'node_modules', '.bin');
  env.PATH = `${binPath}:${env.PATH ?? ''}`;
  const result = runCommand('sh', ['-c', `${script} "$@"`, 'commit-review-check', ...paths], {
    cwd: workspace,
    env,
  });
  const output = [result.stdout, result.stderr]
    .map((value) => String(value ?? ''))
    .filter(Boolean)
    .join('\n');
  const lines = output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const warnings = lines.filter((line) => /\bwarn(?:ing)?\b/i.test(line));
  const nonWarningLines = lines.filter((line) => !warnings.includes(line));
  const errors =
    Number(result.status ?? 1) === 0
      ? []
      : [
          ...(result.error ? [`${check.script} failed: ${errorMessage(result.error)}`] : []),
          ...(nonWarningLines.length > 0
            ? nonWarningLines
            : [`${check.script} exited with status ${result.status ?? 'unknown'}.`]),
        ];
  if (warnings.length > 0 || errors.length > 0) {
    return failedCheck(check, errors, warnings, result.status, paths);
  }
  return {
    name: check.name,
    script: check.script,
    paths,
    status: 'passed',
    exitCode: result.status ?? 0,
    errors: [],
    warnings: [],
  };
}

// checkを実行できない行は成功扱いにせず、理由を残したskipとして返す。
function skippedCheck(check, reason) {
  return {
    name: check.name,
    script: check.script,
    paths: [],
    status: 'skipped',
    reason,
    errors: [],
    warnings: [],
  };
}

// errorとwarningが1つでもあればreviewを起動しない結果へ正規化する。
function failedCheck(check, errors, warnings, status = 1, paths = []) {
  return {
    name: check.name,
    script: check.script,
    paths,
    status: 'failed',
    exitCode: status,
    errors,
    warnings,
  };
}

// 実行結果をJSONに保存できる形へ限定し、spawn失敗も診断へ含める。
function spawnCommand(command, args, options) {
  const result = spawnSync(command, args, {
    ...options,
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  });
  return {
    status: result.status,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
    error: result.error,
  };
}

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import {
  collectStagedSnapshot,
  isReviewablePath,
  runGit,
  validateContextPaths,
} from './lib/snapshot.mjs';
import { workspaceRoot } from './lib/workspace.mjs';

const REQUIRED_REVIEW = 'required';
const OPTIONAL_REVIEW = 'no_review_required';
const OPTIONAL_REVIEW_ALIASES = new Set([OPTIONAL_REVIEW, 'not-required']);

function main() {
  const args = parseArgs(process.argv.slice(2));
  const root = workspaceRoot(args.root);
  const planText = args.planStdin ? readStdin() : readFileSync(args.planPath, 'utf8');
  const plan = parsePlan(planText);
  const snapshot = collectStagedSnapshot(root, { includeEntries: false });
  if (!snapshot.ok) throw new Error(snapshot.message);

  validatePlan(root, snapshot, plan);
  const rows = measureRows(root, plan.rows);
  emit({
    ok: true,
    status: 'measured',
    stagedPaths: snapshot.paths,
    rows,
  });
}

export function parsePlan(raw) {
  const intents = [];
  const rows = [];
  const units = new Set();
  const intentNames = new Set();
  let currentIntent = null;
  let currentUnit = null;
  let readingPaths = false;
  let readingContext = false;

  const flushUnit = () => {
    if (!currentUnit) return;
    if (!currentUnit.review) throw new Error(`Unit "${currentUnit.unit}" is missing Review.`);
    if (currentUnit.paths.length === 0) {
      throw new Error(`Unit "${currentUnit.unit}" must contain at least one path.`);
    }
    rows.push({
      intent: currentIntent.intent,
      behavior: currentIntent.behavior,
      unit: currentUnit.unit,
      review: currentUnit.review,
      paths: currentUnit.paths,
      context: currentUnit.context,
      note: currentUnit.note,
    });
    currentUnit = null;
  };

  const lines = String(raw ?? '')
    .replace(/\r\n?/g, '\n')
    .split('\n');
  for (const line of lines) {
    if (!line.trim()) continue;
    const match = line.match(/^(\s*)-\s+(.+)$/);
    if (!match) throw new Error(`Invalid plan line: ${line}`);
    const indent = match[1].replaceAll('\t', '  ').length;
    const content = match[2].trim();

    if (indent === 0 && content.startsWith('Intent:')) {
      flushUnit();
      const intent = content.slice('Intent:'.length).trim();
      if (!intent) throw new Error('Intent must not be empty.');
      if (intentNames.has(intent)) throw new Error(`Duplicate Intent: ${intent}`);
      intentNames.add(intent);
      currentIntent = { intent, behavior: null, units: [] };
      intents.push(currentIntent);
      readingPaths = false;
      readingContext = false;
      continue;
    }

    if (indent === 2 && content.startsWith('Behavior:')) {
      requireIntent(currentIntent, line);
      const behavior = content.slice('Behavior:'.length).trim();
      if (!behavior) throw new Error(`Behavior for "${currentIntent.intent}" is empty.`);
      currentIntent.behavior = behavior;
      readingPaths = false;
      readingContext = false;
      continue;
    }

    if (indent === 2 && content === 'Units:') {
      requireIntent(currentIntent, line);
      readingPaths = false;
      readingContext = false;
      continue;
    }

    if (indent === 4 && content.startsWith('Unit:')) {
      requireIntent(currentIntent, line);
      flushUnit();
      if (!currentIntent.behavior) {
        throw new Error(`Intent "${currentIntent.intent}" is missing Behavior.`);
      }
      const unit = content.slice('Unit:'.length).trim();
      if (!unit) throw new Error('Unit must not be empty.');
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*-unit-\d+$/i.test(unit)) {
        throw new Error(`Unit "${unit}" must use <intent-slug>-unit-N.`);
      }
      if (units.has(unit)) throw new Error(`Duplicate Unit ID: ${unit}`);
      units.add(unit);
      currentUnit = { unit, review: null, paths: [], context: [], note: null };
      currentIntent.units.push(unit);
      readingPaths = false;
      readingContext = false;
      continue;
    }

    if (indent === 6 && content.startsWith('Review:')) {
      requireUnit(currentUnit, line);
      const review = content.slice('Review:'.length).trim();
      if (![REQUIRED_REVIEW, ...OPTIONAL_REVIEW_ALIASES].includes(review)) {
        throw new Error(
          `Unit "${currentUnit.unit}" Review must be "${REQUIRED_REVIEW}" or "${OPTIONAL_REVIEW}".`,
        );
      }
      currentUnit.review = review === 'not-required' ? OPTIONAL_REVIEW : review;
      readingPaths = false;
      readingContext = false;
      continue;
    }

    if (indent === 6 && content.startsWith('Paths:')) {
      requireUnit(currentUnit, line);
      if (content !== 'Paths:') throw new Error(`Paths must be a nested list: ${line}`);
      readingPaths = true;
      readingContext = false;
      continue;
    }

    if (indent === 6 && content.startsWith('Context:')) {
      requireUnit(currentUnit, line);
      const contextValue = content.slice('Context:'.length).trim();
      if (contextValue === '—' || contextValue === '-') {
        currentUnit.context = [];
        readingPaths = false;
        readingContext = false;
        continue;
      }
      if (content !== 'Context:') throw new Error(`Context must be a nested list: ${line}`);
      readingPaths = false;
      readingContext = true;
      continue;
    }

    if (indent === 6 && content.startsWith('Lines:')) {
      requireUnit(currentUnit, line);
      readingPaths = false;
      readingContext = false;
      continue;
    }

    if (indent === 6 && content.startsWith('Note:')) {
      requireUnit(currentUnit, line);
      const note = content.slice('Note:'.length).trim();
      currentUnit.note = note === '—' || note === '-' ? null : note || null;
      readingPaths = false;
      readingContext = false;
      continue;
    }

    if (indent === 8 && readingPaths) {
      requireUnit(currentUnit, line);
      currentUnit.paths.push(unquotePath(content));
      continue;
    }

    if (indent === 8 && readingContext) {
      requireUnit(currentUnit, line);
      currentUnit.context.push(unquotePath(content));
      continue;
    }

    throw new Error(`Invalid plan line: ${line}`);
  }

  flushUnit();
  if (intents.length === 0) throw new Error('The plan must contain at least one Intent.');
  for (const intent of intents) {
    if (!intent.behavior) throw new Error(`Intent "${intent.intent}" is missing Behavior.`);
    if (intent.units.length === 0) throw new Error(`Intent "${intent.intent}" has no Units.`);
  }
  return { rows };
}

export function validatePlan(root, snapshot, plan) {
  // 計画の分割判断はSkillが持ち、ここでは候補との一致だけを検証する。
  const staged = new Set(snapshot.paths);
  const planned = [];
  const context = [];
  for (const row of plan.rows) {
    if (row.paths.length !== new Set(row.paths).size) {
      throw new Error(`Unit "${row.unit}" contains a duplicate path.`);
    }
    for (const path of row.paths) {
      if (planned.includes(path)) throw new Error(`Path appears more than once: ${path}`);
      planned.push(path);
      const reviewable = isReviewablePath(path);
      if (row.review === REQUIRED_REVIEW && !reviewable) {
        throw new Error(`Non-reviewable path is marked required: ${path}`);
      }
      if (row.review === OPTIONAL_REVIEW && reviewable) {
        throw new Error(`Reviewable path is marked not-required: ${path}`);
      }
    }
    if (row.review === OPTIONAL_REVIEW && row.context.length > 0) {
      throw new Error(`Unit "${row.unit}" cannot define Context without a reviewer.`);
    }
    if (row.context.length !== new Set(row.context).size) {
      throw new Error(`Unit "${row.unit}" contains a duplicate Context path.`);
    }
    context.push(...row.context);
  }

  const missing = planned.filter((path) => !staged.has(path));
  const unplanned = snapshot.paths.filter((path) => !planned.includes(path));
  if (missing.length > 0) throw new Error(`Planned path is not staged: ${missing.join(', ')}`);
  if (unplanned.length > 0) throw new Error(`Staged path is not planned: ${unplanned.join(', ')}`);
  const contextPaths = [...new Set(context)];
  const overlap = contextPaths.filter((path) => planned.includes(path));
  if (overlap.length > 0) {
    throw new Error(
      `Context path must be a Path when it is part of the candidate: ${overlap.join(', ')}`,
    );
  }
  const contextValidation = validateContextPaths(root, contextPaths, snapshot.paths);
  if (!contextValidation.ok) throw new Error(contextValidation.message);
  return { ok: true };
}

export function measureRows(root, rows) {
  const reviewablePaths = rows
    .filter((row) => row.review === REQUIRED_REVIEW)
    .flatMap((row) => row.paths);
  const counts = readNumstat(root, reviewablePaths);

  return rows.map((row) => {
    if (row.review === OPTIONAL_REVIEW) {
      return {
        intent: row.intent,
        behavior: row.behavior,
        unit: row.unit,
        review: row.review,
        paths: row.paths,
        context: row.context,
        files: [],
        lines: null,
        note: row.note,
      };
    }

    const files = row.paths.map((path) => {
      const count = counts.get(path);
      if (!count) throw new Error(`Git diff line count is missing for: ${path}`);
      return { path, ...count };
    });
    const measurable = files.every((file) => file.changedLines !== null);
    return {
      intent: row.intent,
      behavior: row.behavior,
      unit: row.unit,
      review: row.review,
      paths: row.paths,
      context: row.context,
      files,
      lines: measurable ? files.reduce((sum, file) => sum + file.changedLines, 0) : null,
      note: row.note,
    };
  });
}

function readNumstat(root, paths) {
  if (paths.length === 0) return new Map();
  // staged indexを変更せず、Gitが報告する追加・削除行だけを読む。
  const result = runGit(root, [
    'diff',
    '--cached',
    '--numstat',
    '--no-renames',
    '-z',
    'HEAD',
    '--',
    ...paths,
  ]);
  if (!result.ok) throw new Error(result.message);

  const counts = new Map();
  for (const record of bufferText(result.stdout).split('\0').filter(Boolean)) {
    const fields = record.split('\t');
    if (fields.length < 3) throw new Error(`Invalid git numstat record: ${record}`);
    const path = fields.slice(2).join('\t');
    const additions = parseLineCount(fields[0]);
    const deletions = parseLineCount(fields[1]);
    counts.set(path, {
      additions,
      deletions,
      changedLines: additions === null || deletions === null ? null : additions + deletions,
      measurable: additions !== null && deletions !== null,
    });
  }
  return counts;
}

function parseLineCount(value) {
  return value === '-' ? null : Number.parseInt(value, 10);
}

function unquotePath(value) {
  const path = value.trim();
  if (path.length >= 2 && path.startsWith('`') && path.endsWith('`')) {
    return path.slice(1, -1).replaceAll('\\`', '`');
  }
  return path;
}

function requireIntent(intent, line) {
  if (!intent) throw new Error(`Plan line is outside an Intent: ${line}`);
}

function requireUnit(unit, line) {
  if (!unit) throw new Error(`Plan line is outside a Unit: ${line}`);
}

function parseArgs(argv) {
  const args = { root: null, planStdin: false, planPath: null };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === '--root') {
      args.root = argv[index + 1];
      index += 1;
      continue;
    }
    if (value === '--plan-stdin') {
      args.planStdin = true;
      continue;
    }
    if (value === '--plan') {
      args.planPath = argv[index + 1];
      index += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${value}`);
  }
  if (args.planStdin === Boolean(args.planPath)) {
    throw new Error('Use exactly one of --plan-stdin or --plan <path>.');
  }
  return args;
}

function readStdin() {
  return readFileSync(0, 'utf8');
}

function emit(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function bufferText(value) {
  return Buffer.isBuffer(value) ? value.toString('utf8') : String(value ?? '');
}

try {
  main();
} catch (error) {
  emit({ ok: false, status: 'error', message: errorMessage(error) });
  process.exitCode = 1;
}

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

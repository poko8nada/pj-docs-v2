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

// CLIの入力を計画解析、候補検証、Git差分計測の順に通す。
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
  // インデント付き箇条書きを、単一Intent行または複数Unit行へ正規化する。
  const intents = [];
  const rows = [];
  const units = new Set();
  const intentNames = new Set();
  let currentIntent = null;
  let currentEntry = null;
  let readingPaths = false;
  let readingContext = false;
  let listIndent = null;

  // 次のフィールドを読む前に、Paths/Contextのリスト状態を解除する。
  const stopReading = () => {
    readingPaths = false;
    readingContext = false;
    listIndent = null;
  };

  // Unitsを持たないIntentの直接記述へ切り替え、共有の行データを作る。
  const startDirectEntry = (line) => {
    requireIntent(currentIntent, line);
    if (currentIntent.mode === 'units') {
      throw new Error(`Intent "${currentIntent.intent}" cannot mix direct fields with Units.`);
    }
    currentIntent.mode = 'intent';
    if (!currentEntry) currentEntry = createEntry(null);
    return currentEntry;
  };

  // 現在の行を検証済みの測定対象へ確定する。
  const flushEntry = () => {
    if (!currentEntry) return;
    validateEntry(currentIntent, currentEntry);
    rows.push({
      intent: currentIntent.intent,
      behavior: currentIntent.behavior,
      unit: currentEntry.unit,
      commit: currentEntry.unit ? 'unit' : 'intent',
      review: currentEntry.review,
      paths: currentEntry.paths,
      context: currentEntry.context,
      note: currentEntry.note,
    });
    if (currentEntry.unit) currentIntent.units.push(currentEntry.unit);
    currentEntry = null;
  };

  // Intent境界で直前の行を確定し、構造上の必須項目を検証する。
  const flushIntent = () => {
    if (!currentIntent) return;
    flushEntry();
    if (!currentIntent.behavior) {
      throw new Error(`Intent "${currentIntent.intent}" is missing Behavior.`);
    }
    if (currentIntent.mode === 'units' && currentIntent.units.length === 0) {
      throw new Error(`Intent "${currentIntent.intent}" has no Units.`);
    }
    if (!currentIntent.mode) {
      throw new Error(`Intent "${currentIntent.intent}" must define Paths or Units.`);
    }
    currentIntent = null;
    stopReading();
  };

  // Markdownの見た目ではなく、規定したインデントだけを構造として扱う。
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
      flushIntent();
      const intent = content.slice('Intent:'.length).trim();
      if (!intent) throw new Error('Intent must not be empty.');
      if (intentNames.has(intent)) throw new Error(`Duplicate Intent: ${intent}`);
      intentNames.add(intent);
      currentIntent = { intent, behavior: null, mode: null, units: [] };
      intents.push(currentIntent);
      continue;
    }

    if (indent === 2 && content.startsWith('Behavior:')) {
      requireIntent(currentIntent, line);
      const behavior = content.slice('Behavior:'.length).trim();
      if (!behavior) throw new Error(`Behavior for "${currentIntent.intent}" is empty.`);
      currentIntent.behavior = behavior;
      stopReading();
      continue;
    }

    if (indent === 2 && content === 'Units:') {
      requireIntent(currentIntent, line);
      if (currentIntent.mode === 'intent' || currentEntry) {
        throw new Error(`Intent "${currentIntent.intent}" cannot mix direct fields with Units.`);
      }
      currentIntent.mode = 'units';
      stopReading();
      continue;
    }

    if (indent === 4 && content.startsWith('Unit:')) {
      requireIntent(currentIntent, line);
      if (currentIntent.mode !== 'units') {
        throw new Error(`Intent "${currentIntent.intent}" requires Units: before Unit.`);
      }
      flushEntry();
      const unit = content.slice('Unit:'.length).trim();
      if (!unit) throw new Error('Unit must not be empty.');
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*-unit-\d+$/i.test(unit)) {
        throw new Error(`Unit "${unit}" must use <intent-slug>-unit-N.`);
      }
      if (units.has(unit)) throw new Error(`Duplicate Unit ID: ${unit}`);
      units.add(unit);
      currentEntry = createEntry(unit);
      stopReading();
      continue;
    }

    if (indent === 6 && content.startsWith('Review:')) {
      requireEntry(currentEntry, line);
      setReview(currentEntry, content);
      stopReading();
      continue;
    }

    if (indent === 6 && content.startsWith('Paths:')) {
      requireEntry(currentEntry, line);
      if (content !== 'Paths:') throw new Error(`Paths must be a nested list: ${line}`);
      readingPaths = true;
      readingContext = false;
      listIndent = 8;
      continue;
    }

    if (indent === 6 && content.startsWith('Context:')) {
      requireEntry(currentEntry, line);
      const hasList = setContext(currentEntry, content, line);
      if (hasList) {
        readingPaths = false;
        readingContext = true;
        listIndent = 8;
      } else {
        stopReading();
      }
      continue;
    }

    if (indent === 6 && content.startsWith('Lines:')) {
      requireEntry(currentEntry, line);
      stopReading();
      continue;
    }

    if (indent === 6 && content.startsWith('Note:')) {
      requireEntry(currentEntry, line);
      setNote(currentEntry, content);
      stopReading();
      continue;
    }

    if (indent === 2 && content.startsWith('Review:')) {
      const entry = startDirectEntry(line);
      setReview(entry, content);
      stopReading();
      continue;
    }

    if (indent === 2 && content.startsWith('Paths:')) {
      startDirectEntry(line);
      if (content !== 'Paths:') throw new Error(`Paths must be a nested list: ${line}`);
      readingPaths = true;
      readingContext = false;
      listIndent = 4;
      continue;
    }

    if (indent === 2 && content.startsWith('Context:')) {
      const entry = startDirectEntry(line);
      const hasList = setContext(entry, content, line);
      if (hasList) {
        readingPaths = false;
        readingContext = true;
        listIndent = 4;
      } else {
        stopReading();
      }
      continue;
    }

    if (indent === 2 && content.startsWith('Lines:')) {
      startDirectEntry(line);
      stopReading();
      continue;
    }

    if (indent === 2 && content.startsWith('Note:')) {
      const entry = startDirectEntry(line);
      setNote(entry, content);
      stopReading();
      continue;
    }

    if (indent === listIndent && readingPaths) {
      requireEntry(currentEntry, line);
      currentEntry.paths.push(unquotePath(content));
      continue;
    }

    if (indent === listIndent && readingContext) {
      requireEntry(currentEntry, line);
      currentEntry.context.push(unquotePath(content));
      continue;
    }

    throw new Error(`Invalid plan line: ${line}`);
  }

  flushIntent();
  if (intents.length === 0) throw new Error('The plan must contain at least one Intent.');
  return { rows };
}

export function validatePlan(root, snapshot, plan) {
  // 分割判断はSkillが持ち、ここでは候補の全PathとContextの一致だけを検証する。
  const staged = new Set(snapshot.paths);
  const planned = [];
  const context = [];
  for (const row of plan.rows) {
    const label = row.unit ? `Unit "${row.unit}"` : `Intent "${row.intent}"`;
    if (row.paths.length !== new Set(row.paths).size) {
      throw new Error(`${label} contains a duplicate path.`);
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
      throw new Error(`${label} cannot define Context without a reviewer.`);
    }
    if (row.context.length !== new Set(row.context).size) {
      throw new Error(`${label} contains a duplicate Context path.`);
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
  // review対象だけをGitで計測し、no_review_required行には差分行数を付けない。
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
        commit: row.commit,
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
      commit: row.commit,
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
  // binary差分の「-」は数えられない値として扱い、後段で停止させる。
  return value === '-' ? null : Number.parseInt(value, 10);
}

function unquotePath(value) {
  // 計画例で使うバッククォートを剥がし、Gitへ渡す実パスへ戻す。
  const path = value.trim();
  if (path.length >= 2 && path.startsWith('`') && path.endsWith('`')) {
    return path.slice(1, -1).replaceAll('\\`', '`');
  }
  return path;
}

function createEntry(unit) {
  // 単一IntentとUnitが共有する最小の計画行状態を作る。
  return { unit, review: null, paths: [], context: [], note: null };
}

function validateEntry(intent, entry) {
  // 行単位でReviewとPathを必須にし、空のレビュー単位を通さない。
  const label = entry.unit ? `Unit "${entry.unit}"` : `Intent "${intent.intent}"`;
  if (!entry.review) throw new Error(`${label} is missing Review.`);
  if (entry.paths.length === 0) throw new Error(`${label} must contain at least one path.`);
}

function requireIntent(intent, line) {
  // Intentより外側にあるフィールドは、意味を持たないため拒否する。
  if (!intent) throw new Error(`Plan line is outside an Intent: ${line}`);
}

function requireEntry(entry, line) {
  // PathsやReviewがUnit/Intent行の外側に出ていないことを確認する。
  if (!entry) throw new Error(`Plan line is outside a plan entry: ${line}`);
}

function setReview(entry, content) {
  // 表記揺れを正規化し、後続処理が二つのReview状態だけを扱えるようにする。
  const review = content.slice('Review:'.length).trim();
  if (![REQUIRED_REVIEW, ...OPTIONAL_REVIEW_ALIASES].includes(review)) {
    const label = entry.unit ? `Unit "${entry.unit}"` : 'Intent';
    throw new Error(`${label} Review must be "${REQUIRED_REVIEW}" or "${OPTIONAL_REVIEW}".`);
  }
  entry.review = review === 'not-required' ? OPTIONAL_REVIEW : review;
}

function setContext(entry, content, line) {
  // Context: — は空リスト、それ以外のContext:は次行のパスリストとして扱う。
  const contextValue = content.slice('Context:'.length).trim();
  if (contextValue === '—' || contextValue === '-') {
    entry.context = [];
    return false;
  }
  if (content !== 'Context:') throw new Error(`Context must be a nested list: ${line}`);
  return true;
}

function setNote(entry, content) {
  // Noteのダッシュ表記をnullへ正規化し、レビュー引数へ渡せる状態にする。
  const note = content.slice('Note:'.length).trim();
  entry.note = note === '—' || note === '-' ? null : note || null;
}

function parseArgs(argv) {
  // 計画本文の入力元だけを受け取り、測定処理に不要な引数は拒否する。
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
  // Skillが合意済みの計画本文を標準入力からそのまま受け取る。
  return readFileSync(0, 'utf8');
}

function emit(value) {
  // Skillが計画測定結果を機械的に解釈できるJSONだけを出力する。
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function bufferText(value) {
  // GitのBuffer出力と通常の文字列を同じ読み取り経路に揃える。
  return Buffer.isBuffer(value) ? value.toString('utf8') : String(value ?? '');
}

try {
  main();
} catch (error) {
  emit({ ok: false, status: 'error', message: errorMessage(error) });
  process.exitCode = 1;
}

function errorMessage(error) {
  // CLIの失敗応答へErrorのmessageだけを安定して取り出す。
  return error instanceof Error ? error.message : String(error);
}

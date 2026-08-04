/** smoke: Harness の review gate と state binding */

import { mkdirSync, mkdtempSync, readFileSync, statSync, utimesSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { writeLastPromptId } from '../lib/state.mjs';
import { reviewResultArtifactPath } from '../lib/review.mjs';

/** @param {import('./_harness.mjs').SmokeCtx} smoke */
export function runReviewGate(smoke) {
  const { root, smokeTmpRoot, stateTmp, run, assert, findStateFileName, loadState, saveState } =
    smoke;

  // 旧stateを次回保存時に新しいreview形へ正規化する。
  {
    const id = 'review-state-migration-id';
    const repo = createWorkspace(smokeTmpRoot);
    prepareGateState(repo, id, saveState);
    const statePath = join(stateTmp, findStateFileName(repo, id));
    const legacy = JSON.parse(readFileSync(statePath, 'utf8'));
    legacy.review = {
      reviewStartedAt: '2026-08-03T15:49:13.204+09:00',
      snapshotHash: 'sha256:legacy',
      snapshotAt: '2026-08-03T15:49:13.204+09:00',
      reviewerTranscriptPath: '/legacy/transcript.jsonl',
      files: ['src/change.mjs'],
      dirtyAt: '2026-08-03T15:49:13.204+09:00',
      binding: 'unbound',
    };
    writeFileSync(statePath, `${JSON.stringify(legacy, null, 2)}\n`);

    saveState(repo, id, { phase: legacy.phase });
    const migrated = JSON.parse(readFileSync(statePath, 'utf8'));
    assert(
      'state update removes legacy review fields',
      Object.keys(migrated.review).toSorted().join(',') ===
        'binding,reviewStartedAt,reviewerTranscriptId',
      JSON.stringify(migrated.review),
    );
    assert(
      'legacy transcript path is not copied into the new review shape',
      migrated.review.reviewerTranscriptId === null,
      JSON.stringify(migrated.review),
    );
  }

  // Harnessはreview scriptの実行を記録するが、Skillのpayload自体は実行しない。
  {
    const id = 'review-script-required-id';
    const repo = createWorkspace(smokeTmpRoot);
    prepareGateState(repo, id, saveState);
    startReview(run, repo, id);
    const review = loadState(repo, id).review;
    assert(
      'Harness records review start without legacy review fields',
      typeof review.reviewStartedAt === 'string' &&
        !Object.hasOwn(review, 'snapshotHash') &&
        !Object.hasOwn(review, 'snapshotAt') &&
        !Object.hasOwn(review, 'reviewerTranscriptPath'),
      JSON.stringify(review),
    );
  }

  // review script未実行なら、結果artifactがなくてもcommitを許可しない。
  {
    const id = 'commit-script-missing-start-id';
    const repo = createWorkspace(smokeTmpRoot);
    prepareGateState(repo, id, saveState);
    const out = runCommitGate(run, repo, id);
    assert(
      'commit script denies before review script',
      out.permission === 'deny' &&
        String(out.agent_message).includes('before the review script was run'),
      JSON.stringify(out),
    );
  }

  // review scriptを開始したが結果artifactがない場合も許可しない。
  {
    const id = 'commit-script-missing-result-id';
    const repo = createWorkspace(smokeTmpRoot);
    prepareGateState(repo, id, saveState);
    startReview(run, repo, id);
    const out = runCommitGate(run, repo, id);
    assert(
      'commit script denies without review result',
      out.permission === 'deny' &&
        String(out.agent_message).includes('result is missing or invalid'),
      JSON.stringify(out),
    );
  }

  // GAPSはreviewer transcriptが紐付いていてもcommitを許可しない。
  {
    const id = '10000000-0000-4000-8000-000000000002';
    const repo = createWorkspace(smokeTmpRoot);
    prepareGateState(repo, id, saveState);
    startReview(run, repo, id);
    writeReviewResult(repo, id, 'review_required');
    const transcripts = mkdtempSync(join(smokeTmpRoot, 'transcripts-gaps-'));
    writeReviewTranscripts(transcripts, id, reviewPrompt(repo, id), 'GAPS');

    const out = runCommitGate(run, repo, id, transcripts);
    assert(
      'commit script denies reviewer GAPS',
      out.permission === 'deny' &&
        String(out.agent_message).includes(
          'A reviewer PASS has not been verified after the latest review script run.',
        ),
      JSON.stringify(out),
    );
  }

  // 親promptと一致しないPASSは、候補を推測せず拒否する。
  {
    const id = '10000000-0000-4000-8000-000000000003';
    const repo = createWorkspace(smokeTmpRoot);
    prepareGateState(repo, id, saveState);
    startReview(run, repo, id);
    writeReviewResult(repo, id, 'review_required');
    const transcripts = mkdtempSync(join(smokeTmpRoot, 'transcripts-mismatch-'));
    writeReviewTranscripts(
      transcripts,
      id,
      reviewPrompt(repo, id),
      'PASS',
      null,
      `${reviewPrompt(repo, id)} mismatch`,
    );

    const out = runCommitGate(run, repo, id, transcripts);
    assert(
      'commit script denies a PASS for a different request',
      out.permission === 'deny' &&
        String(out.agent_message).includes(
          'A reviewer PASS has not been verified after the latest review script run.',
        ),
      JSON.stringify(out),
    );
  }

  // 複数のPASS候補がある場合は、一意に特定できないため拒否する。
  {
    const id = '10000000-0000-4000-8000-000000000004';
    const repo = createWorkspace(smokeTmpRoot);
    prepareGateState(repo, id, saveState);
    startReview(run, repo, id);
    writeReviewResult(repo, id, 'review_required');
    const transcripts = mkdtempSync(join(smokeTmpRoot, 'transcripts-ambiguous-'));
    const prompt = reviewPrompt(repo, id);
    writeReviewTranscripts(transcripts, id, prompt, 'PASS', '20000000-0000-4000-8000-000000000041');
    writeReviewTranscripts(transcripts, id, prompt, 'PASS', '20000000-0000-4000-8000-000000000042');

    const out = runCommitGate(run, repo, id, transcripts);
    assert(
      'commit script denies ambiguous reviewer PASS candidates',
      out.permission === 'deny' &&
        String(out.agent_message).includes(
          'A reviewer PASS has not been verified after the latest review script run.',
        ),
      JSON.stringify(out),
    );
  }

  // PASSは親のrequestとchild transcriptが一意に一致した場合だけ通す。
  {
    const id = '10000000-0000-4000-8000-000000000001';
    const repo = createWorkspace(smokeTmpRoot);
    prepareGateState(repo, id, saveState);
    startReview(run, repo, id);
    writeReviewResult(repo, id, 'review_required');
    const transcripts = mkdtempSync(join(smokeTmpRoot, 'transcripts-pass-'));
    const reviewerId = writeReviewTranscripts(transcripts, id, reviewPrompt(repo, id), 'PASS');

    const out = runCommitGate(run, repo, id, transcripts);
    const review = loadState(repo, id).review;
    assert(
      'commit script allows a matching reviewer PASS',
      out.permission === 'allow',
      JSON.stringify(out),
    );
    assert(
      'Harness binds and consumes the matching reviewer transcript',
      review.binding === 'bound' &&
        review.reviewerTranscriptId === reviewerId &&
        statSync(join(transcripts, reviewerId, `${reviewerId}.harness-pass-used`)).isFile(),
      JSON.stringify(review),
    );

    const boundOut = runCommitGate(run, repo, id, transcripts);
    assert(
      'bound reviewer PASS allows a retry before commit completion',
      boundOut.permission === 'allow',
      JSON.stringify(boundOut),
    );

    run('track.mjs', {
      conversation_id: id,
      workspace_roots: [repo],
      cwd: repo,
      hook_event_name: 'afterShellExecution',
      command: 'node .cursor/skills/commit/scripts/commit.mjs --message-stdin',
      exit_code: 0,
    });
    assert(
      'successful commit script resets review state',
      loadState(repo, id).review.reviewStartedAt === null &&
        loadState(repo, id).review.binding === null &&
        loadState(repo, id).review.reviewerTranscriptId === null,
      JSON.stringify(loadState(repo, id).review),
    );
  }

  // 実際のreview.mjsがresult/request artifactを作り、Skillのhash検証が変更候補を拒否する。
  {
    const id = '10000000-0000-4000-8000-000000000005';
    const repo = createGitWorkspace(smokeTmpRoot);
    prepareGateState(repo, id, saveState);
    startReview(run, repo, id);
    const review = runReviewScript(root, repo, id);
    const transcripts = mkdtempSync(join(smokeTmpRoot, 'transcripts-e2e-'));
    const reviewerId = writeReviewTranscripts(transcripts, id, review.request.prompt, 'PASS');

    const gate = runCommitGate(run, repo, id, transcripts);
    assert(
      'commit script gate accepts the real review artifact PASS',
      gate.permission === 'allow',
      JSON.stringify(gate),
    );
    assert(
      'review.mjs writes the required result and request artifacts',
      review.status === 'review_required' &&
        readFileSync(review.resultArtifact, 'utf8').trim() === 'review_required' &&
        readFileSync(review.requestArtifact, 'utf8').startsWith('[commit-review-payload]'),
      JSON.stringify(review),
    );
    assert(
      'real review PASS is bound to the reviewer transcript',
      loadState(repo, id).review.reviewerTranscriptId === reviewerId,
      JSON.stringify(loadState(repo, id).review),
    );

    writeFileSync(join(repo, 'change.mjs'), 'export const value = 3;\n');
    runGit(repo, ['add', '--', 'change.mjs']);
    const commit = runCommitScript(root, repo, id, validCommitMessage());
    assert(
      'commit.mjs rejects a staged change after the captured PASS',
      commit.status === 'rejected' &&
        String(commit.message).includes('staged commit candidate changed'),
      JSON.stringify(commit),
    );
  }

  // 対象外 staged fileだけなら、Skillが書いた結果artifactでreviewerなしを許可する。
  {
    const id = 'commit-script-no-review-id';
    const repo = createWorkspace(smokeTmpRoot);
    prepareGateState(repo, id, saveState);
    startReview(run, repo, id);
    writeReviewResult(repo, id, 'no_review_required');

    const out = runCommitGate(run, repo, id);
    assert(
      'commit script allows the explicit no-review result',
      out.permission === 'allow',
      JSON.stringify(out),
    );
  }

  // heredocの本文はcommand matcherに影響せず、commit scriptを識別できる。
  {
    const id = 'commit-script-heredoc-id';
    const repo = createWorkspace(smokeTmpRoot);
    prepareGateState(repo, id, saveState);
    startReview(run, repo, id);
    writeReviewResult(repo, id, 'no_review_required');

    const out = run('gate.mjs', {
      conversation_id: id,
      workspace_roots: [repo],
      cwd: repo,
      hook_event_name: 'beforeShellExecution',
      command: [
        "node .cursor/skills/commit/scripts/commit.mjs --message-stdin <<'COMMIT_MESSAGE'",
        'Clarify smoke commit flow',
        '',
        'Why:',
        'The smoke test needs a multiline commit message.',
        '',
        'What:',
        'Exercise the commit script matcher.',
        '',
        'Verify:',
        '- smoke gate',
        'COMMIT_MESSAGE',
      ].join('\n'),
    });
    assert(
      'Harness recognizes commit script with heredoc stdin',
      out.permission === 'allow',
      JSON.stringify(out),
    );
  }
}

function createWorkspace(tmpRoot) {
  const repo = mkdtempSync(join(tmpRoot, 'review-gate-workspace-'));
  mkdirSync(join(repo, '.cursor/skills/commit/scripts/.tmp'), { recursive: true });
  return repo;
}

function prepareGateState(repo, id, saveState) {
  saveState(repo, id, {
    phase: 'chore',
    unlock: { scope: true, rules: true },
  });
  writeLastPromptId(repo, id);
}

function startReview(run, repo, id) {
  run('track.mjs', {
    conversation_id: id,
    workspace_roots: [repo],
    cwd: repo,
    hook_event_name: 'beforeShellExecution',
    command: 'node .cursor/skills/commit/scripts/review.mjs --note "user accepted exclusion"',
  });
}

function writeReviewResult(repo, id, status) {
  const path = reviewResultArtifactPath(repo, id);
  mkdirSync(join(path, '..'), { recursive: true });
  writeFileSync(path, `${status}\n`);
}

function reviewPrompt(repo, id) {
  const artifact = join(repo, '.cursor/skills/commit/scripts/.tmp', `${id}.request`);
  return [
    '[commit-review-artifact]',
    `Review Payload Artifact: ${artifact}`,
    'Read the generated artifact as the complete review payload. If it lists Context Files, read only those exact files. Do not run Git or inspect unrelated files.',
  ].join('\n');
}

function runCommitGate(run, repo, id, transcripts = null) {
  return run(
    'gate.mjs',
    {
      conversation_id: id,
      workspace_roots: [repo],
      cwd: repo,
      hook_event_name: 'beforeShellExecution',
      command: 'node .cursor/skills/commit/scripts/commit.mjs --message-stdin',
    },
    transcripts ? { CURSOR_GATE_TRANSCRIPTS_DIR: transcripts } : {},
  );
}

function writeReviewTranscripts(
  transcripts,
  parentId,
  prompt,
  verdict,
  reviewerId = null,
  reviewerPrompt = prompt,
) {
  const resolvedReviewerId = reviewerId ?? reviewerIdFor(parentId);
  const parentDir = join(transcripts, parentId);
  const reviewerDir = join(transcripts, resolvedReviewerId);
  mkdirSync(parentDir, { recursive: true });
  mkdirSync(reviewerDir, { recursive: true });

  writeFileSync(
    join(parentDir, `${parentId}.jsonl`),
    `${JSON.stringify({
      role: 'assistant',
      message: {
        content: [{ type: 'tool_use', name: 'Subagent', input: { prompt } }],
      },
    })}\n`,
  );
  const reviewerPath = join(reviewerDir, `${resolvedReviewerId}.jsonl`);
  writeFileSync(
    reviewerPath,
    `${JSON.stringify({
      role: 'user',
      message: { content: [{ type: 'text', text: 'Earlier review context.' }] },
    })}\n` +
      `${JSON.stringify({
        role: 'user',
        message: { content: [{ type: 'text', text: reviewerPrompt }] },
      })}\n` +
      `${JSON.stringify({
        role: 'assistant',
        message: { content: [{ type: 'text', text: `REVIEW: ${verdict}` }] },
      })}\n`,
  );
  const reviewTime = new Date(Date.now() + 1000);
  utimesSync(reviewerPath, reviewTime, reviewTime);
  return resolvedReviewerId;
}

function createGitWorkspace(tmpRoot) {
  const repo = createWorkspace(tmpRoot);
  runGit(repo, ['init', '-q']);
  runGit(repo, ['config', 'user.name', 'Hook Smoke']);
  runGit(repo, ['config', 'user.email', 'hook-smoke@example.invalid']);
  writeFileSync(join(repo, 'change.mjs'), 'export const value = 1;\n');
  runGit(repo, ['add', '--', 'change.mjs']);
  runGit(repo, ['commit', '-qm', 'init']);
  writeFileSync(join(repo, 'change.mjs'), 'export const value = 2;\n');
  runGit(repo, ['add', '--', 'change.mjs']);
  return repo;
}

function runReviewScript(root, repo, id) {
  const script = join(root, '.cursor/skills/commit/scripts/review.mjs');
  const result = spawnSync(process.execPath, [script, '--root', repo], {
    cwd: root,
    encoding: 'utf8',
    env: cleanGitEnv(id),
  });
  if (result.status !== 0) throw new Error(`review.mjs exited ${result.status}: ${result.stderr}`);
  return JSON.parse(result.stdout);
}

function runCommitScript(root, repo, id, message) {
  const script = join(root, '.cursor/skills/commit/scripts/commit.mjs');
  const result = spawnSync(process.execPath, [script, '--root', repo, '--message-stdin'], {
    cwd: root,
    encoding: 'utf8',
    input: `${message}\n`,
    env: cleanGitEnv(id),
  });
  return JSON.parse(result.stdout);
}

function runGit(repo, args) {
  const result = spawnSync('git', args, {
    cwd: repo,
    encoding: 'utf8',
    env: cleanGitEnv(null),
  });
  if (result.status !== 0) throw new Error(`git ${args.join(' ')} failed: ${result.stderr}`);
  return result;
}

function cleanGitEnv(id) {
  const env = { ...process.env };
  delete env.GIT_INDEX_FILE;
  if (id) env.CURSOR_CONVERSATION_ID = id;
  return env;
}

function validCommitMessage() {
  return [
    'Update smoke candidate',
    '',
    'Why:',
    'Verify the staged candidate boundary.',
    '',
    'What:',
    'Exercise the commit script hash check.',
    '',
    'Verify:',
    '- Hook smoke',
  ].join('\n');
}

function reviewerIdFor(parentId) {
  const suffix = String(parentId)
    .replaceAll('-', '')
    .replace(/[^a-f0-9]/gi, '')
    .padStart(12, '0')
    .slice(-12);
  return `20000000-0000-4000-8000-${suffix}`;
}

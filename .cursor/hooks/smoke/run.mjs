#!/usr/bin/env node
/**
 * ゲート hooks のスモークテスト入口（Cursor 実行時なし）。
 * 使い方: node .cursor/hooks/smoke/run.mjs
 */
import { createSmokeCtx, finishSmokeCtx } from './_harness.mjs';
import { runPhaseCore, runResumeTtl, runRulesUnlock } from './phase.mjs';
import { runInjectGateListing, runInjectSticky } from './inject.mjs';
import { runTranscriptFallback, runStickyContamination } from './sticky.mjs';
import { runBootstrap } from './bootstrap.mjs';
import { runCdRoot } from './shell.mjs';
import { runReviewGate } from './review.mjs';
import { runCheckPending } from './check.mjs';
import { runReadRefs, runIssueHeredoc } from './refs.mjs';
import { runMentorStub, runPnpmEarly } from './mentor.mjs';

const ctx = createSmokeCtx();
let failed = 0;

try {
  // 順序依存あり — 分割前モノリスの並びを維持
  runPhaseCore(ctx);
  runResumeTtl(ctx);
  runInjectGateListing(ctx);
  runTranscriptFallback(ctx);
  runRulesUnlock(ctx);
  runStickyContamination(ctx);
  runBootstrap(ctx);
  runCdRoot(ctx);
  runReviewGate(ctx);
  runCheckPending(ctx);
  runReadRefs(ctx);
  runIssueHeredoc(ctx);
  runInjectSticky(ctx);
  runMentorStub(ctx);
  runPnpmEarly(ctx);
} catch (err) {
  failed += 1;
  process.stderr.write(`FAIL - uncaught: ${err && err.stack ? err.stack : err}\n`);
} finally {
  failed += finishSmokeCtx(ctx);
}

if (failed > 0) {
  process.stderr.write(`\n${failed} failed\n`);
  process.exit(1);
}
process.stdout.write('\nall passed\n');

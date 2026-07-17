#!/usr/bin/env node
import { parseRemovedNotesFromDiff } from './list-removed.mjs';

let failed = 0;

function assert(name, cond, detail = '') {
  if (!cond) {
    process.stderr.write(`FAIL ${name}${detail ? `: ${detail}` : ''}\n`);
    failed += 1;
  }
}

const sample = `diff --git a/src/foo.ts b/src/foo.ts
--- a/src/foo.ts
+++ b/src/foo.ts
@@ -10 +9,0 @@
-// NOTE: temporary stub
`;

const removed = parseRemovedNotesFromDiff(sample);
assert('finds one removed NOTE', removed.length === 1);
assert('line number', removed[0]?.line === 10);

if (failed > 0) process.exit(1);
process.stdout.write('all passed\n');

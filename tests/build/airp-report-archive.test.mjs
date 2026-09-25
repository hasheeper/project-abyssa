import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { compactReportArchive } from '../../scripts/lib/airp-report-archive.mjs';

test('report compaction changes only JSON whitespace, preserving original strings, arrays and keys', () => {
  const data = {archiveVersion: 4, record: {text: ' 原文\n\n  不裁卡书。 ', choices: ['A', 'B'], obsolete: null}};
  const pretty = JSON.stringify(data, null, 8), compact = compactReportArchive(pretty);
  assert.equal(compact, JSON.stringify(data));
  assert.deepEqual(JSON.parse(compact), data);
  assert.throws(() => compactReportArchive('{broken'));
});

test('report whitespace no longer spends archive capacity; real content size/complexity limits still apply', async () => {
  const vite = await createServer({configFile: false, server: {middlewareMode: true, hmr: false, ws: false, watch: null}, appType: 'custom'});
  try {
    const {parseJson, DATA_LIMITS} = await vite.ssrLoadModule('/src/game-core/contracts/validation.ts');
    const data = {text: '完整原文'}, compact = JSON.stringify(data);
    const padded = ' '.repeat(DATA_LIMITS.bytes) + compact;
    assert.throws(() => parseJson(padded), /JSON size limit exceeded/);
    assert.deepEqual(parseJson(compactReportArchive(padded)), data);
    const tooLarge = compactReportArchive(JSON.stringify({text: 'x'.repeat(DATA_LIMITS.bytes + 1)}));
    assert.throws(() => parseJson(tooLarge), /JSON size limit exceeded/);
    let deep = {};
    for (let i = 0; i <= DATA_LIMITS.depth; i++) deep = {deep};
    assert.throws(() => parseJson(compactReportArchive(JSON.stringify(deep))), /JSON complexity limit exceeded/);
  } finally { await vite.close(); }
});

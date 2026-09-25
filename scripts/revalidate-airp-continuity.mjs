// Lossless offline extraction only. Never changes the frozen frame/raw/failed attempt.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createServer } from 'vite';

assert.equal(process.argv.length, 3, 'Use <airp-continuity report directory>');
const directory = path.resolve(process.argv[2]);
assert(path.dirname(directory) === path.join(process.cwd(), 'dist/reports') && path.basename(directory).startsWith('airp-continuity-'));
globalThis.fetch = async () => { throw Error('Network is prohibited during offline extraction'); };
const vite = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false, ws: false, watch: null }, appType: 'custom' });
try {
  const names = ['frame.json', 'writing-raw.txt', 'run.json'];
  const originals = await Promise.all(names.map(n => fs.readFile(path.join(directory, n), 'utf8')));
  const frame = JSON.parse(originals[0]), run = JSON.parse(originals[2]);
  // writing-raw is saved only after the provider accepted finish=stop, not from a filtered diagnostic.
  assert(run.attempts.some(a => a.stage === 'writing' && ['invalid-input', 'validation-error'].includes(a.code)));
  const { readLowWriting } = await vite.ssrLoadModule('/src/game-application/airp-low/output.ts');
  const { validateLowFrame } = await vite.ssrLoadModule('/src/game-application/airp-low/native.ts');
  validateLowFrame(frame);
  const read = readLowWriting(originals[1], frame, 4);
  const chars = text => [...text.replace(/\s/g, '')].length;
  const total = read.text.lines.reduce((n, l) => n + chars(l.text), 0);
  const report = { classification: 'offline-reader4-extraction-only', modelCalls: 0, originalAttemptsUnchanged: true,
    sourceRequestHash: frame.requestHash, warnings: read.warnings, text: read.text,
    metrics: { characters: total, paragraphs: read.text.lines.length, dialoguePercent: Math.round(1000 * read.text.lines.filter(l => l.speaker !== 'narrator').reduce((n, l) => n + chars(l.text), 0) / total) / 10 },
    formattingModelRun: false, gameSaveApplied: false, contentAcceptance: 'not-passed; options still operational' };
  await fs.writeFile(path.join(directory, 'reader4-verification.json'), JSON.stringify(report, null, 2), { mode: 0o600 });
  await fs.writeFile(path.join(directory, 'text-cn-reader4.md'), `# 回馆反馈 · reader4离线提取（未启用）\n\n${read.text.lines.map(l => `${l.speaker}[${l.emotion}]：${l.text}`).join('\n\n')}\n\n${read.text.choices.map((c, i) => `${i + 1}. ${c}`).join('\n')}\n`, { mode: 0o600 });
  assert.deepEqual(await Promise.all(names.map(n => fs.readFile(path.join(directory, n), 'utf8'))), originals);
  console.log(JSON.stringify({ directory, ...report, text: undefined }));
} finally { await vite.close(); }

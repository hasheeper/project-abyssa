// Read/replay an incomplete real CL-F checkpoint. Never asserts full-loop/content acceptance.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createServer } from 'vite';

assert.equal(process.argv.length, 3, 'Use <CL-F report directory>');
const root = process.cwd(), directory = path.resolve(process.argv[2]);
assert(path.dirname(directory) === path.join(root, 'dist/reports') && path.basename(directory).startsWith('airp-cl-f-'));
const vite = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false, ws: false, watch: null }, appType: 'custom' });
try {
  const load = name => vite.ssrLoadModule(`/src/${name}.ts`);
  const { parseTestConfig } = await load('game-infrastructure/airp-direct/test-config');
  const config = parseTestConfig(await fs.readFile('config/airp-test.local.json', 'utf8'));
  const meta = JSON.parse(await fs.readFile(path.join(directory, 'run.json'), 'utf8'));
  let archive = await fs.readFile(path.join(directory, 'formal-save.json'), 'utf8');
  assert(!Object.values(config.keys).filter(Boolean).some(key => archive.includes(key)), 'Credential in report');
  const endpoints = [...new Set(Object.values(config.models).map(m => m.baseUrl))].sort((a, b) => b.length - a.length);
  endpoints.forEach((url, i) => { archive = archive.replaceAll(`[configured-endpoint:${i}]`, url); });
  const catalog = meta.contentVersion === 24 ? (await load('game-runtime/shop-wave-context')).SHOP_AIRP_CATALOG : (await load('game-runtime/airp-game-context')).AIRP_GAME_CATALOG;
  const { readD5Archive } = await load('game-application/versions/d5-validate');
  const { D5_RUN_READERS } = await load('game-core/session/index');
  const r = readD5Archive(archive, catalog, D5_RUN_READERS), s = r.airpGame.settlement;
  const nodes = Object.values(r.airpGame.nodes).flatMap(l => l.jobs);
  const attempts = [...r.airpDirector.jobs.flatMap(j => j.attempts), ...r.airpGame.gm.jobs.flatMap(j => j.attempts), ...nodes.flatMap(j => j.attempts), ...s.jobs.flatMap(j => j.attempts)];
  assert.equal(attempts.length, meta.calls);
  const chars = text => [...text.replace(/\s/g, '')].length;
  const metrics = nodes.filter(j => j.text).map(j => {
    const total = j.text.lines.reduce((n, l) => n + chars(l.text), 0);
    return { node: j.node.id, status: j.status, characters: total, paragraphs: j.text.lines.length,
      dialoguePercent: Math.round(j.text.lines.filter(l => l.speaker !== 'narrator').reduce((n, l) => n + chars(l.text), 0) * 1000 / total) / 10,
      warnings: j.writingWarnings, revalidation: j.writingRevalidation ?? null };
  });
  const event = r.airpDirector.events.find(e => e.id === meta.eventId);
  const result = { classification: 'partial-checkpoint-replay-only', replay: 'passed', fullLoopCompleted: meta.completed,
    contentAcceptance: 'not-passed; inspect original scenes and audit', contentVersion: r.contentRef.contentVersion, nextStep: meta.step,
    networkCalls: 0, gameCallsInReport: meta.calls, externalCalls: meta.externalCalls ?? 0, cumulativeGameCalls: meta.initialCalls + meta.calls + (meta.externalCalls ?? 0),
    reportedTokens: attempts.reduce((n, a) => n + (a.usage.totalTokens ?? 0), 0),
    successfulAttemptTokens: attempts.filter(a => a.status === 'succeeded').reduce((n, a) => n + (a.usage.totalTokens ?? 0), 0),
    failedAttemptTokens: attempts.filter(a => a.status !== 'succeeded').reduce((n, a) => n + (a.usage.totalTokens ?? 0), 0),
    unknownUsageAttempts: attempts.filter(a => a.usage.totalTokens === null).length,
    currentRun: r.snapshot.run?.id ?? null, event: { status: event.status, delivery: event.delivery?.status ?? null },
    affinity: s.state.affinity, memoryPoints: s.memories.reduce((n, m) => n + m.points.length, 0), openThreads: s.openThreads.map(t => ({ id: t.id, text: t.text })),
    settlements: s.jobs.map(j => ({ id: j.id, status: j.status, version: j.frames.at(-1).promptVersion, attempts: j.attempts.length })), metrics };
  await fs.writeFile(path.join(directory, 'checkpoint-verification.json'), JSON.stringify(result, null, 2), { mode: 0o600 });
  console.log(JSON.stringify(result, null, 2));
} catch (e) { console.error(String(e?.message ?? 'Checkpoint replay failed').split('\n')[0]); process.exitCode = 1; }
finally { await vite.close(); }

// Inspect actual frozen home-settlement input, without credentials/network or archive mutation.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createServer } from 'vite';

assert.equal(process.argv.length, 3, 'Use <CL-F report directory>');
const directory = path.resolve(process.argv[2]);
assert(path.dirname(directory) === path.join(process.cwd(), 'dist/reports') && path.basename(directory).startsWith('airp-cl-f-'));
globalThis.fetch = async () => { throw Error('Network prohibited'); };
const vite = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false, ws: false, watch: null }, appType: 'custom' });
try {
  const original = await fs.readFile(path.join(directory, 'formal-save.json'), 'utf8');
  const r = JSON.parse(original).record, ledger = r.airpGame.settlement;
  const job = ledger.jobs.findLast(j => j.frames.at(-1).input.scope.kind === 'event');
  assert(job, 'No real event-closure settlement frame yet');
  const f = job.frames.at(-1), event = r.airpDirector.events.find(e => e.id === f.input.scope.eventId);
  assert(event?.delivery?.status === 'confirmed');
  const runId = event.delivery.runId;
  const originals = ledger.jobs.filter(j => j.status === 'applied' && j.frames.at(-1).input.scope.runId === runId)
    .flatMap(j => { const previous = j.frames.at(-1); return previous.input.evidence.filter(s => s.role === 'current' && s.kind === 'read-paragraph')
      .map(source => ({ source, original: previous.materials.evidence.find(e => e.sourceId === source.id) })); });
  assert(originals.length > 0, 'No real node-read originals');
  assert.equal(new Set(f.input.evidence.map(s => s.id)).size, f.input.evidence.length);
  for (const { source, original: text } of originals) {
    assert.deepEqual(f.input.evidence.find(e => e.id === source.id), { ...source, role: 'history' }, 'Dropped/changed paragraph attribution or knowledge');
    assert.deepEqual(f.materials.evidence.find(e => e.sourceId === source.id), text, 'Original read text/digest changed');
  }
  const terminal = r.facts.find(x => x.id === event.delivery.returnFactId).payload.terminal;
  const summary = JSON.parse(f.materials.evidence.find(e => e.sourceId === event.delivery.returnFactId).text);
  assert.deepEqual(summary.partyIds, terminal.partyIds); assert.equal(summary.deepestLayer, terminal.deepestLayer);
  assert.equal(summary.routeId, terminal.routeId); assert.equal(summary.eventClosed, false);
  const { compileSettlementRequest } = await vite.ssrLoadModule('/src/game-application/airp-settlement/context.ts');
  compileSettlementRequest(f, job.frames.length - 1); // verifies the frozen request hash
  const result = { classification: 'actual-frozen-return-input-only', networkCalls: 0, credentialsRead: false,
    settlementVersion: f.promptVersion, runId, nodeOriginalParagraphs: originals.length,
    privateNarrationParagraphs: originals.filter(p => p.source.authority === 'fact').length,
    exactTextsDigestsAttributionAndAudience: true, noDuplicateIds: true,
    realTerminal: { routeId: summary.routeId, deepestLayer: summary.deepestLayer, partyIds: summary.partyIds },
    modelOutputQuality: 'separate-content-review-required', archiveReplay: 'separate-check-required' };
  // The live runner can advance meanwhile; this checker never rewrites its save/meta.
  await fs.writeFile(path.join(directory, 'return-context-verification.json'), JSON.stringify(result, null, 2), { mode: 0o600 });
  console.log(JSON.stringify(result, null, 2));
} finally { await vite.close(); }

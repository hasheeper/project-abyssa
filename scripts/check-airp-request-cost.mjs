// Offline comparison against real frozen requests. No configuration, credentials or network.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createServer } from 'vite';

assert(process.argv.length === 3 || process.argv.length === 4 && process.argv[3] === '--write', 'Use <CL-F report directory> [--write]');
const directory = path.resolve(process.argv[2]);
assert(path.dirname(directory) === path.join(process.cwd(), 'dist/reports') && path.basename(directory).startsWith('airp-cl-f-'));
const size = value => Buffer.byteLength(JSON.stringify(value));
// Only local, acyclic, standalone $refs occur in these schemas. Fail on anything else.
function expandSchema(root) {
  function visit(node, active = []) {
    if (Array.isArray(node)) return node.map(n => visit(n, active));
    if (!node || typeof node !== 'object') return node;
    if ('$ref' in node) {
      assert.deepEqual(Object.keys(node), ['$ref']);
      const match = /^#\/\$defs\/([A-Za-z0-9]+)$/.exec(node.$ref);
      assert(match && !active.includes(match[1]) && root.$defs?.[match[1]], 'Unresolvable or cyclic schema reference');
      return visit(root.$defs[match[1]], [...active, match[1]]);
    }
    return Object.fromEntries(Object.entries(node).filter(([k]) => k !== '$defs').map(([k, v]) => [k, visit(v, active)]));
  }
  return visit(root);
}
function compare(oldRequest, newRequest, kind, index) {
  assert.deepEqual(oldRequest.messages.map(m => m.role), newRequest.messages.map(m => m.role));
  assert.equal(oldRequest.messages[0].content, newRequest.messages[0].content, 'Instruction changed');
  const oldPayload = JSON.parse(oldRequest.messages[1].content), newPayload = JSON.parse(newRequest.messages[1].content);
  const { outputSchema: before, ...oldData } = oldPayload, { outputSchema: after, ...newData } = newPayload;
  assert.deepEqual(oldData, newData, 'Context/materials/IDs changed');
  assert.deepEqual(expandSchema(before), expandSchema(after), 'Expanded output constraints changed');
  const beforeBytes = size(oldRequest.messages), afterBytes = size(newRequest.messages);
  assert(afterBytes < beforeBytes, 'No measurable byte reduction');
  return { kind, index, beforeBytes, afterBytes, savedBytes: beforeBytes - afterBytes,
    reductionPercent: Math.round((beforeBytes - afterBytes) * 1000 / beforeBytes) / 10,
    schemaBeforeBytes: size(before), schemaAfterBytes: size(after), expandedSchemaEqual: true, allOtherInputEqual: true };
}

globalThis.fetch = async () => { throw new Error('Network is prohibited in offline cost verification'); };
const vite = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false, ws: false, watch: null }, appType: 'custom' });
try {
  const archivePath = path.join(directory, 'formal-save.json'), metaPath = path.join(directory, 'run.json');
  const originalArchive = await fs.readFile(archivePath, 'utf8'), originalMeta = await fs.readFile(metaPath, 'utf8');
  const r = JSON.parse(originalArchive).record, meta = JSON.parse(originalMeta), rows = [];
  const load = name => vite.ssrLoadModule(`/src/game-application/${name}.ts`);
  const settlement = await load('airp-settlement/context'), gm = await load('airp-expedition-gm/context');
  const { settlementOutputSchema } = await load('airp-settlement/prompt');
  const { canonicalJson } = await vite.ssrLoadModule('/src/game-core/contracts/index.ts');
  // Recompile every old frozen request first, checking its original hash without rewriting it.
  for (const [j, job] of r.airpGame.settlement.jobs.entries()) for (const [i, f] of job.frames.entries()) {
    const oldRequest = settlement.compileSettlementRequest(f, i);
    if (f.promptVersion !== 'cl-b-settlement-6') continue; // Earlier instructions differ: not a schema-only A/B.
    // Hold the old instruction fixed even when a later semantic version exists.
    // This is a schema-only counterfactual, not a live v8 cost measurement.
    const payload = JSON.parse(oldRequest.messages[1].content);
    const nextRequest = { messages: [oldRequest.messages[0], { role: 'user', content: canonicalJson({ ...payload, outputSchema: settlementOutputSchema(f.input) }) }] };
    rows.push(compare(oldRequest, nextRequest, 'settlement', `${j}:${i}`));
  }
  for (const [j, job] of r.airpGame.gm.jobs.entries()) for (const [i, f] of job.frames.entries()) {
    const oldRequest = gm.compileExpeditionRequest(f, i);
    if (f.promptVersion !== 'cl-c-gm-1') continue;
    const fresh = gm.freezeExpeditionFrame(f.context, f.documents, f.departure);
    rows.push(compare(oldRequest, gm.compileExpeditionRequest(fresh, i), 'expedition-gm', `${j}:${i}`));
  }
  assert(rows.some(r => r.kind === 'settlement') && rows.some(r => r.kind === 'expedition-gm'), 'Missing frozen comparison samples');
  const attempts = [
    ...r.airpDirector.jobs.flatMap(j => j.attempts.map(a => ({ ...a, category: `home:${a.stage}` }))),
    ...r.airpGame.gm.jobs.flatMap(j => j.attempts.map(a => ({ ...a, category: `expedition-gm:${a.stage}` }))),
    ...Object.values(r.airpGame.nodes).flatMap(l => l.jobs.flatMap(j => j.attempts.map(a => ({ ...a, category: `node:${a.stage}` })))),
    ...r.airpGame.settlement.jobs.flatMap(j => j.attempts.map(a => ({ ...a, category: 'settlement' }))),
  ];
  assert.equal(attempts.length, meta.calls);
  const usageByStage = Object.entries(Object.groupBy(attempts, a => a.category)).map(([stage, aa]) => ({ stage, calls: aa.length,
    inputTokens: aa.reduce((n, a) => n + (a.usage.inputTokens ?? 0), 0), outputTokens: aa.reduce((n, a) => n + (a.usage.outputTokens ?? 0), 0),
    totalTokens: aa.reduce((n, a) => n + (a.usage.totalTokens ?? 0), 0), unknownUsageAttempts: aa.filter(a => Object.values(a.usage).some(n => n === null)).length }));
  const providerDetails = meta.history.filter(h => Number.isInteger(h.response)).map(h => ({ call: h.response, inputTokens: h.inputTokens,
    outputTokens: h.outputTokens, reasoningTokens: h.reasoningTokens, contentCharacters: h.contentChars, elapsedMs: h.elapsedMs }));
  assert.equal(await fs.readFile(archivePath, 'utf8'), originalArchive, 'Archive changed');
  assert.equal(await fs.readFile(metaPath, 'utf8'), originalMeta, 'Run ledger changed');
  const result = { classification: 'offline-schema-and-usage-analysis-only', networkCalls: 0, credentialsRead: false,
    comparisonMethod: 'schema-only counterfactual; frozen instructions and all context held fixed',
    liveModelAcceptance: 'not-tested', fullLoopCompleted: meta.completed, contentAcceptance: 'not-claimed',
    byteMetric: 'UTF-8 JSON messages; not token counts, prices or live savings', gameCallsInReport: meta.calls,
    cumulativeGameCalls: meta.initialCalls + meta.calls + (meta.externalCalls ?? 0), comparisons: rows, usageByStage, providerDetails };
  if (process.argv[3] === '--write') await fs.writeFile(path.join(directory, 'request-cost-verification.json'), JSON.stringify(result, null, 2), { mode: 0o600 });
  console.log(JSON.stringify(result, null, 2));
} catch (e) { console.error(String(e?.message ?? 'Offline cost verification failed').split('\n')[0]); process.exitCode = 1; }
finally { await vite.close(); }

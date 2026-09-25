// Explicit opt-in, one-call CL-B acceptance. No browser, recordings, or production save access.
// node scripts/verify-airp-settlement.mjs --live <expected-cumulative-calls>
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createServer } from 'vite';

assert(process.argv[2] === '--live' && /^\d+$/.test(process.argv[3] ?? '') && process.argv.length === 4, 'Use --live <expected-cumulative-calls>');
const root = process.cwd(), expected = Number(process.argv[3]);
const ledgerPath = path.join(root, 'dist/reports/airp-live/call-ledger.json');
let ledger = JSON.parse(await fs.readFile(ledgerPath, 'utf8'));
assert(ledger.calls === expected && ledger.calls < ledger.limit, 'Cumulative call budget changed/exhausted; do not reset it');
const vite = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false }, appType: 'custom' });
let directory, sanitize = () => '[details withheld]';
try {
  const { parseTestConfig } = await vite.ssrLoadModule('/src/game-infrastructure/airp-direct/test-config.ts');
  // Credential data is used only for authentication; never print it or write it to reports.
  const config = parseTestConfig(await fs.readFile(path.join(root, 'config/airp-test.local.json'), 'utf8'));
  const secrets = Object.values(config.keys).filter(Boolean), endpoints = Object.values(config.models).map(m => m.baseUrl).filter(Boolean);
  sanitize = value => {
    let text = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
    assert(!secrets.some(s => text.includes(s)), 'Credential detected; refusing report');
    for (const endpoint of [...endpoints].sort((a, b) => b.length - a.length)) text = text.replaceAll(endpoint, '[configured-endpoint]');
    return text;
  };
  const { settlementGameplayCase, gameplaySettlementInput } = await vite.ssrLoadModule('/src/game-application/testing/airp-settlement-gameplay-case.ts');
  const { clbHost } = await vite.ssrLoadModule('/src/game-application/testing/airp-settlement-fixture.ts');
  const { compileSettlementRequest } = await vite.ssrLoadModule('/src/game-application/airp-settlement/context.ts');
  const { createSettlementDriver } = await vite.ssrLoadModule('/src/game-runtime/airp-settlement-driver.ts');
  const { createDirectProvider } = await vite.ssrLoadModule('/src/game-infrastructure/airp-direct/provider.ts');
  const play = await settlementGameplayCase(), packet = gameplaySettlementInput(play.closed, 'event', play.eventId), host = clbHost(packet.input);
  const jobId = await host.service.enqueue(packet.input, packet.materials);
  const request = compileSettlementRequest((await host.service.read()).ledger.jobs[0].frames[0], 0);
  directory = await fs.mkdtemp(path.join(root, 'dist/reports/airp-cl-b-')); await fs.chmod(directory, 0o700);
  const save = (name, value) => fs.writeFile(path.join(directory, name), sanitize(value), { mode: 0o600 });
  await save('input.json', { classification: 'real-program-boundary/mock-prior-prose/test-only-balancing', input: packet.input, materials: packet.materials, request });
  let dispatched = 0;
  const provider = createDirectProvider(async (...args) => {
    assert.equal(dispatched, 0, 'This runner never automatically resends');
    ledger = JSON.parse(await fs.readFile(ledgerPath, 'utf8'));
    assert(ledger.calls === expected && ledger.calls < ledger.limit, 'Budget changed before dispatch');
    // Reserve before dispatch. A failed/unknown result is still a paid attempt; never decrement it.
    await fs.writeFile(ledgerPath, JSON.stringify({ ...ledger, calls: ledger.calls + 1 })); dispatched++;
    return fetch(...args);
  });
  const driver = createSettlementDriver({ provider, lock: async (_name, _signal, run) => run() });
  console.log(JSON.stringify({ event: 'cl-b-request', model: config.models.updater.model, requestBytes: Buffer.byteLength(JSON.stringify(request.messages)), fullCards: packet.materials.cards.map(c => ({ actorId: c.actorId, characters: c.text.length })), sourceCount: packet.input.evidence.length, callCeiling: expected + 1 }));
  await driver.run(host.port, jobId, { config: config.models.updater, key: config.keys.updater });
  const snapshot = await host.service.read(), job = snapshot.ledger.jobs[0];
  const report = { classification: 'real-settlement-model/real-program-boundary/mock-prior-prose', model: config.models.updater.model, status: driver.getSnapshot(), calls: dispatched,
    attempts: job.attempts, receipts: snapshot.ledger.receipts, memories: snapshot.ledger.memories, state: snapshot.ledger.state };
  await save('result.json', report);
  if (driver.getSnapshot().pendingResult) await save('unsaved-result.json', driver.exportPending());
  console.log(sanitize({ event: 'cl-b-result', status: job.status, calls: dispatched, attempts: job.attempts.map(a => ({ status: a.status, error: a.error, usage: a.usage })), effects: snapshot.ledger.receipts.flatMap(r => r.effects), directory }));
  assert.equal(job.status, 'applied', 'Settlement did not apply; inspect the preserved output before any retry');
  const before = dispatched;
  await driver.run(host.port, jobId, { config: config.models.updater, key: config.keys.updater });
  assert.equal(dispatched, before, 'Committed task was resent');
  assert.equal((await host.service.contextForNextGm()).pending.length, 0);
  console.log(JSON.stringify({ event: 'cl-b-replay', extraCalls: dispatched - before, gmContextReady: true }));
} catch (error) {
  console.log(sanitize({ event: 'cl-b-stopped', reason: String(error?.message ?? 'failed').split('\n')[0], directory }));
  process.exitCode = 1;
} finally { await vite.close(); }

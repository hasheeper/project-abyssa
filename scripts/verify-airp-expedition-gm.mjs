// Explicit non-visual, one-call CL-C acceptance. No production save writes.
// node scripts/verify-airp-expedition-gm.mjs --live <expected-cumulative-calls> <commission|exploration>
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createServer } from 'vite';

assert(process.argv[2] === '--live' && /^\d+$/.test(process.argv[3] ?? '') && ['commission', 'exploration'].includes(process.argv[4]) && process.argv.length === 5, 'Use --live <expected-cumulative-calls> <commission|exploration>');
const root = process.cwd(), expected = Number(process.argv[3]), scenario = process.argv[4], ledgerPath = path.join(root, 'dist/reports/airp-live/call-ledger.json');
let ledger = JSON.parse(await fs.readFile(ledgerPath, 'utf8'));
assert(ledger.calls === expected && ledger.calls < ledger.limit, 'Call budget changed/exhausted; do not reset it');
const vite = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false }, appType: 'custom' });
let directory, sanitize = () => '[details withheld]';
try {
  const { parseTestConfig } = await vite.ssrLoadModule('/src/game-infrastructure/airp-direct/test-config.ts');
  const config = parseTestConfig(await fs.readFile(path.join(root, 'config/airp-test.local.json'), 'utf8'));
  const secrets = Object.values(config.keys).filter(Boolean), endpoints = Object.values(config.models).map(m => m.baseUrl).filter(Boolean);
  sanitize = value => { let text = typeof value === 'string' ? value : JSON.stringify(value, null, 2); assert(!secrets.some(s => text.includes(s)), 'Credential in report; refusing to persist'); for (const endpoint of endpoints.sort((a, b) => b.length - a.length)) text = text.replaceAll(endpoint, '[configured-endpoint]'); return text; };
  const { expeditionGameplayCase } = await vite.ssrLoadModule('/src/game-application/testing/airp-expedition-gm-gameplay-case.ts');
  const { clcHost } = await vite.ssrLoadModule('/src/game-application/testing/airp-expedition-gm-fixture.ts');
  const { compileExpeditionRequest } = await vite.ssrLoadModule('/src/game-application/airp-expedition-gm/context.ts');
  const { createExpeditionGMDriver } = await vite.ssrLoadModule('/src/game-runtime/airp-expedition-gm-driver.ts');
  const { createDirectProvider } = await vite.ssrLoadModule('/src/game-infrastructure/airp-direct/provider.ts');
  const { validateExpeditionPlan } = await vite.ssrLoadModule('/src/game-core/session/index.ts');
  const { packet } = await expeditionGameplayCase(scenario === 'commission'), host = clcHost(packet), jobId = await host.service.enqueue();
  const frame = (await host.service.read()).ledger.jobs[0].frames[0], request = compileExpeditionRequest(frame, 0);
  directory = await fs.mkdtemp(path.join(root, 'dist/reports/airp-cl-c-')); await fs.chmod(directory, 0o700);
  const save = (name, value) => fs.writeFile(path.join(directory, name), sanitize(value), { mode: 0o600 });
  await save('input.json', { classification: 'actual-program-preparation/mock-prior-prose/isolated-host/no-new-side-events-or-assets', scenario, frame, request });
  let calls = 0;
  const provider = createDirectProvider(async (...args) => {
    assert.equal(calls, 0, 'No automatic retry in CL-C runner'); ledger = JSON.parse(await fs.readFile(ledgerPath, 'utf8'));
    assert(ledger.calls === expected && ledger.calls < ledger.limit, 'Budget changed before dispatch');
    await fs.writeFile(ledgerPath, JSON.stringify({ ...ledger, calls: ledger.calls + 1 })); calls++; return fetch(...args);
  });
  const driver = createExpeditionGMDriver({ provider, lock: async (_name, _signal, fn) => fn() });
  console.log(sanitize({ event: 'cl-c-request', scenario, model: config.models.planning.model, bytes: Buffer.byteLength(JSON.stringify(request.messages)), sources: packet.context.sources.length, documents: packet.documents.map(d => ({ id: d.id, characters: d.text.length })), callCeiling: expected + 1 }));
  await driver.run(host.port, jobId, { config: config.models.planning, key: config.keys.planning });
  const snapshot = await host.service.read(), job = snapshot.ledger.jobs[0];
  let diagnostic = null;
  if (job.status !== 'accepted' && job.attempts[0]?.output) { try { validateExpeditionPlan(frame.context.rules, JSON.parse(job.attempts[0].output), frame.inputHash); } catch (error) { diagnostic = String(error.message); } }
  const report = { scenario, classification: 'real-GM/actual-program-state/mock-prior-prose/isolated-host', model: config.models.planning.model, calls, status: driver.getSnapshot(), diagnostic, job, programUnchanged: host.raw().program, sharedSchedule: snapshot.context.rules.schedule };
  await save('result.json', report); if (driver.getSnapshot().pendingResult) await save('unsaved-result.json', driver.exportPending());
  console.log(sanitize({ event: 'cl-c-result', status: job.status, diagnostic, calls, attempts: job.attempts.map(a => ({ status: a.status, stage: a.stage, usage: a.usage })), nodes: job.prepared?.proposal.nodes.length, directory }));
  assert.equal(job.status, 'accepted', 'GM plan did not pass; inspect preserved output before any explicit retry');
  const permit = await host.service.departurePermit(jobId); await driver.run(host.port, jobId, { config: config.models.planning, key: config.keys.planning });
  assert.equal(calls, 1); await save('replay.json', { extraCalls: 0, permit, classification: 'permit-only/no-real-departure' });
  console.log(JSON.stringify({ event: 'cl-c-replay', extraCalls: 0, runId: permit.departure.runId, started: false }));
} catch (error) {
  console.log(sanitize({ event: 'cl-c-stopped', reason: String(error?.message ?? 'failed').split('\n')[0], directory })); process.exitCode = 1;
} finally { await vite.close(); }

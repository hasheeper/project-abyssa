// Explicit CL-D three-call, non-visual acceptance in one development owning root.
// node scripts/verify-airp-node.mjs --live <expected-cumulative-calls>
// Explicit recovery: add --reuse-writing <report-dir> or --resume-settlement <report-dir>.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createServer } from 'vite';

const resumeSettlement = process.argv[4] === '--resume-settlement';
const reuse = process.argv[4] === '--reuse-writing' || resumeSettlement ? process.argv[5] : null;
assert(process.argv[2] === '--live' && /^\d+$/.test(process.argv[3] ?? '') && (process.argv.length === 4 || reuse && process.argv.length === 6), 'Use --live <expected-cumulative-calls> [--reuse-writing <saved-report-directory>]');
const root = process.cwd(), expected = Number(process.argv[3]), ledgerPath = path.join(root, 'dist/reports/airp-live/call-ledger.json');
const callLimit = resumeSettlement ? 1 : reuse ? 2 : 3;
let ledger = JSON.parse(await fs.readFile(ledgerPath, 'utf8'));
assert(ledger.calls === expected && ledger.calls + callLimit <= ledger.limit, 'Budget changed/exhausted; never reset');
const vite = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false, ws: false, watch: null }, appType: 'custom' });
let directory, sanitize = () => '[details withheld]';
try {
  const load = name => vite.ssrLoadModule(`/src/${name}.ts`);
  const { parseTestConfig } = await load('game-infrastructure/airp-direct/test-config');
  const config = parseTestConfig(await fs.readFile(path.join(root, 'config/airp-test.local.json'), 'utf8'));
  const secrets = Object.values(config.keys).filter(Boolean), endpoints = Object.values(config.models).map(m => m.baseUrl).filter(Boolean);
  sanitize = value => { let text = typeof value === 'string' ? value : JSON.stringify(value, null, 2); assert(!secrets.some(s => text.includes(s)), 'Credential detected; refusing report'); for (const e of endpoints.sort((a, b) => b.length - a.length)) text = text.replaceAll(e, '[configured-endpoint]'); return text; };
  const { nodeFixture, readAndChooseNode } = await load('game-application/testing/airp-node-fixture');
  const { createNodeDriver } = await load('game-runtime/airp-expedition-play-driver');
  const { createSettlementDriver } = await load('game-runtime/airp-settlement-driver');
  const { createLowProvider } = await load('game-infrastructure/airp-direct/low-provider');
  const { createDirectProvider } = await load('game-infrastructure/airp-direct/provider');
  const { compileLowRequest } = await load('game-application/airp-low/output');
  const { lowHash } = await load('game-application/airp-low/native');
  const { compileSettlementRequest } = await load('game-application/airp-settlement/context');
  const { nextD5PlayCommand } = await load('game-application/testing/d5-playthrough');
  const { AIRP_DIRECTOR_CATALOG } = await load('game-runtime/airp-director-context');
  const f = await nodeFixture(), id = f.raw().nodes.jobs[0].id;
  await f.nodes.open(id);
  directory = await fs.mkdtemp(path.join(root, 'dist/reports/airp-cl-d-')); await fs.chmod(directory, 0o700);
  const save = (name, value) => fs.writeFile(path.join(directory, name), sanitize(value), { mode: 0o600 });
  const classification = 'real-D5-departure/real-Low-and-settlement/mock-GM-and-prior-prose/development-owner/no-final-drop-adapter';
  await save('input.json', { classification, frame: f.raw().nodes.jobs[0].frame, request: compileLowRequest(f.raw().nodes.jobs[0].frame) });
  let calls = 0;
  const transport = async (...args) => {
    assert(calls < callLimit, 'Only one explicit attempt per stage'); ledger = JSON.parse(await fs.readFile(ledgerPath, 'utf8'));
    assert(ledger.calls === expected + calls && ledger.calls < ledger.limit, 'Budget changed before dispatch');
    await fs.writeFile(ledgerPath, JSON.stringify({ ...ledger, calls: ledger.calls + 1 })); calls++; return fetch(...args);
  };
  const lock = async (_name, _signal, fn) => fn(), driver = createNodeDriver({ lock, provider: createLowProvider(transport) });
  for (const stage of ['writing', 'formatting']) {
    const slot = stage === 'writing' ? 'writing' : 'updater', model = config.models[slot];
    console.log(sanitize({ event: 'cl-d-request', stage, model: model.model, directory }));
    if (stage === 'formatting') { const j = f.raw().nodes.jobs[0]; await save('format-input.json', compileLowRequest(j.frame, j.attempts[0].output)); }
    if (reuse && (stage === 'writing' || resumeSettlement)) {
      const reusePath = path.resolve(reuse); assert(reusePath.startsWith(path.join(root, 'dist/reports/airp-cl-d-')), 'Reuse only a local CL-D report');
      const prior = JSON.parse(await fs.readFile(path.join(reusePath, `${stage}-result.json`), 'utf8')), a = prior.job.attempts.find(a => a.stage === stage);
      assert(prior.job.frame.requestHash === f.raw().nodes.jobs[0].frame.requestHash && a.connectionHash === lowHash(model) && a.output, 'Cannot reuse changed request/model');
      await f.nodes.begin(id, { id: a.id, stage, model: a.model, connectionHash: a.connectionHash, at: a.at });
      await f.nodes.result(id, a.id, a.output, a.usage, a.endedAt);
      await save(`reused-${stage}.json`, { source: path.relative(root, reusePath), extraCalls: 0, outputHash: lowHash(a.output), originalStatus: a.status, revalidated: true });
    } else await driver.run(f.nodePort, id, { config: model, key: config.keys[slot] });
    const job = f.raw().nodes.jobs[0]; await save(`${stage}-result.json`, { classification, model: model.model, status: driver.getSnapshot(), job });
    await save('development-root.json', f.raw());
    if (driver.getSnapshot().pendingResult) await save('unsaved-result.json', driver.exportPending());
    console.log(sanitize({ event: 'cl-d-result', stage, status: job.attempts.at(-1)?.status, driver: driver.getSnapshot(), writingWarnings: job.writingWarnings, usage: job.attempts.at(-1)?.usage, reused: !!reuse && (stage === 'writing' || resumeSettlement) }));
    assert.equal(job.attempts.at(-1)?.status, 'succeeded', 'Stage failed; inspect saved raw output, do not reroll');
  }
  const text = f.raw().nodes.jobs[0].text;
  await save('chinese.md', `# CL-D 当前入口：真实Low中文稿\n\n${text.lines.map(l => `${l.speaker === 'narrator' ? '' : l.speaker + '[' + l.emotion + ']：'}${l.text}`).join('\n\n')}\n\n【可选回应】\n\n${text.choices.map((c, i) => `${i + 1}. ${c}`).join('\n')}\n`);
  await readAndChooseNode(f, id); // Deterministic tester choice, not an actual user's acceptance.
  const packet = await f.nodes.settlementInput(id), taskId = await f.settlement.enqueue(packet.input, packet.materials);
  await save('settlement-input.json', { classification, testerSelectedIndex: 0, packet, request: compileSettlementRequest(f.raw().settlement.jobs[0].frames[0], 0) });
  const settle = createSettlementDriver({ lock, provider: createDirectProvider(transport) });
  if (resumeSettlement) {
    const original = JSON.parse(await fs.readFile(path.join(path.resolve(reuse), 'settlement-result.json'), 'utf8')), job = original.ledger.jobs[0], a = job.attempts[0];
    assert(job.status === 'failed' && a.output && job.frames[0].requestHash === f.raw().settlement.jobs[0].frames[0].requestHash && a.connectionHash === lowHash(config.models.updater), 'Only explicitly retry the unchanged frozen settlement');
    await f.settlement.begin(taskId, { id: a.id, model: a.model, connectionHash: a.connectionHash, at: a.startedAt });
    await f.settlement.result({ jobId: taskId, attemptId: a.id, output: a.output, usage: a.usage, at: a.endedAt });
    const replayStatus = f.raw().settlement.jobs[0].status;
    assert(['failed', 'ready'].includes(replayStatus), 'Revalidate original output with current admission rules');
    await save('explicit-settlement-retry.json', { source: path.relative(root, path.resolve(reuse)), sameFrozenRequest: true, previousOutputHash: lowHash(a.output), historicalStatus: a.status, replayStatus, noProseResend: true });
  }
  console.log(sanitize({ event: f.raw().settlement.jobs[0].status === 'ready' ? 'cl-d-offline-apply' : 'cl-d-request', stage: 'settlement', model: config.models.updater.model }));
  await settle.run(f.settlementPort, taskId, { config: config.models.updater, key: config.keys.updater });
  await save('settlement-result.json', { classification, status: settle.getSnapshot(), ledger: f.raw().settlement });
  await save('development-root.json', f.raw());
  if (settle.getSnapshot().pendingResult) await save('unsaved-settlement.json', settle.exportPending());
  console.log(sanitize({ event: 'cl-d-result', stage: 'settlement', status: f.raw().settlement.jobs[0].status, usage: f.raw().settlement.jobs[0].attempts.at(-1)?.usage }));
  assert.equal(f.raw().settlement.jobs[0].status, 'applied', 'CL-B failed; preserve evidence, do not mock the real result');
  await f.nodes.complete(id);
  const before = calls; f.restore(f.raw()); await driver.run(f.nodePort, id, { config: config.models.writing, key: config.keys.writing });
  await settle.run(f.settlementPort, taskId, { config: config.models.updater, key: config.keys.updater }); assert.equal(calls, before);
  let commands = 0;
  while (commands < 140 && !(await f.nodes.read()).program.slotIds.includes('slot:1:0:cleared')) { await f.send(nextD5PlayCommand(AIRP_DIRECTOR_CATALOG, f.raw().gameplay)); commands++; }
  assert((await f.nodes.read()).program.slotIds.includes('slot:1:0:cleared'), 'Actual first-room clear not reached');
  await f.nodes.sync(); const second = f.raw().nodes.jobs[1]; await f.nodes.open(second.id);
  const next = f.raw().nodes.jobs[1].frame;
  assert(next.scene.userInput.includes(text.lines.find(l => l.speaker !== 'narrator').text), 'Missing full previous dialogue');
  assert(next.scene.userInput.includes(text.choices[0]), 'Missing actual tester attitude');
  await save('next-input.json', { classification: 'real-previous-Low/real-settlement/real-program-clear/next-node-not-generated', frame: next, commands });
  await save('replay.json', { calls, extraCalls: calls - before, commands, nodes: f.raw().nodes.jobs.map(j => ({ id: j.id, status: j.status, reads: j.reads.length })), receipts: f.raw().settlement.receipts, programCommits: f.raw().programCommits });
  await save('development-root.json', f.raw());
  console.log(sanitize({ event: 'cl-d-complete', calls, cumulative: expected + calls, nextInputReady: true, nextNodeGenerated: false, directory }));
} catch (error) { console.log(sanitize({ event: 'cl-d-stopped', reason: String(error?.message ?? 'failed').split('\n')[0], directory })); process.exitCode = 1; }
finally { await vite.close(); }

// Opt-in, non-visual acceptance using the formal content22 GameStore, not a developer root.
// node scripts/verify-airp-formal.mjs --live <expected-cumulative-calls>
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createServer } from 'vite';

assert(process.argv[2] === '--live' && /^\d+$/.test(process.argv[3] ?? '') && process.argv.length === 4, 'Use --live <expected-cumulative-calls>');
const root = process.cwd(), expected = Number(process.argv[3]), ledgerPath = path.join(root, 'dist/reports/airp-live/call-ledger.json');
let ledger = JSON.parse(await fs.readFile(ledgerPath, 'utf8'));
assert(ledger.calls === expected && ledger.calls + 4 <= ledger.limit, 'Budget changed or exhausted');
const vite = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false, ws: false, watch: null }, appType: 'custom' });
let directory, sanitize = () => '[details withheld]';
try {
  const load = name => vite.ssrLoadModule(`/src/${name}.ts`);
  const { parseTestConfig } = await load('game-infrastructure/airp-direct/test-config');
  const config = parseTestConfig(await fs.readFile(path.join(root, 'config/airp-test.local.json'), 'utf8'));
  const secrets = Object.values(config.keys).filter(Boolean), endpoints = Object.values(config.models).map(m => m.baseUrl).filter(Boolean);
  sanitize = value => {
    let text = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
    assert(!secrets.some(s => text.includes(s)), 'Credential detected; refuse report');
    for (const e of endpoints.sort((a, b) => b.length - a.length)) text = text.replaceAll(e, '[configured-endpoint]');
    return text;
  };
  const { formalAirpFixture, formalRead } = await load('game-application/testing/airp-game-fixture');
  const { airpGameView } = await load('game-runtime/airp-game-runtime');
  const { createExpeditionGMDriver } = await load('game-runtime/airp-expedition-gm-driver');
  const { createNodeDriver } = await load('game-runtime/airp-expedition-play-driver');
  const { createSettlementDriver } = await load('game-runtime/airp-settlement-driver');
  const { createLowProvider } = await load('game-infrastructure/airp-direct/low-provider');
  const { createDirectProvider } = await load('game-infrastructure/airp-direct/provider');
  const { nextD5PlayCommand } = await load('game-application/testing/d5-playthrough');
  const { AIRP_GAME_CATALOG } = await load('game-runtime/airp-game-context');
  const { readD5Archive } = await load('game-application/versions/d5-validate');
  const { D5_RUN_READERS } = await load('game-core/session/index');
  const f = await formalAirpFixture('tide-reef.ordinary'), flow = f.flow;
  directory = await fs.mkdtemp(path.join(root, 'dist/reports/airp-formal-')); await fs.chmod(directory, 0o700);
  const save = (name, value) => fs.writeFile(path.join(directory, name), sanitize(value), { mode: 0o600 });
  const classification = 'formal-content22/GameStore/real-GM-Low-format-settlement/tester-actions/no-player-save/no-visual';
  let calls = 0, commands = 0;
  const transport = async (...args) => {
    assert(calls < 4, 'Four explicit stages maximum, no repair or reroll');
    ledger = JSON.parse(await fs.readFile(ledgerPath, 'utf8'));
    assert(ledger.calls === expected + calls && ledger.calls < ledger.limit, 'Shared budget changed before dispatch');
    await fs.writeFile(ledgerPath, JSON.stringify({ ...ledger, calls: ledger.calls + 1 })); calls++; return fetch(...args);
  };
  const lock = async (_name, _signal, fn) => fn();
  const gmDriver = createExpeditionGMDriver({ lock, provider: createDirectProvider(transport) });
  const nodeDriver = createNodeDriver({ lock, provider: createLowProvider(transport) });
  const settlementDriver = createSettlementDriver({ lock, provider: createDirectProvider(transport) });
  const connection = slot => ({ config: config.models[slot], key: config.keys[slot] });
  const checkpoint = async (stage, driver) => {
    await save('formal-save.json', { archiveVersion: 4, record: f.raw() });
    await save(`${stage}.json`, { classification, stage, status: driver.getSnapshot(), calls, commands });
    if (driver.getSnapshot().pendingResult) await save(`${stage}-unsaved.json`, driver.exportPending());
    console.log(sanitize({ event: 'formal-result', stage, status: driver.getSnapshot(), calls, directory }));
    assert.equal(driver.getSnapshot().error, null, `${stage} failed; inspect originals, do not reroll`);
  };
  const planId = await flow.prepare(f.departure);
  console.log(sanitize({ event: 'formal-request', stage: 'gm', model: config.models.planning.model, directory }));
  await gmDriver.run(flow.host.gm, planId, connection('planning')); await checkpoint('gm', gmDriver);
  assert.equal(f.raw().airpGame.gm.jobs[0].status, 'accepted');
  const permit = await flow.gm.departurePermit(planId); await f.send({ type: 'start-expedition', ...permit.departure }); await flow.sync();
  while (!airpGameView(f.raw())?.node && f.raw().snapshot.run && commands < 400) {
    await f.send(nextD5PlayCommand(AIRP_GAME_CATALOG, f.raw())); await flow.sync(); commands++;
    if (commands % 8 === 0) await new Promise(resolve => setTimeout(resolve, 0));
  }
  const id = airpGameView(f.raw())?.node?.id; assert(id, 'No actual planned node reached; do not fabricate a trigger');
  await flow.nodes.open(id);
  for (const stage of ['writing', 'formatting']) {
    console.log(sanitize({ event: 'formal-request', stage, model: config.models[stage === 'writing' ? 'writing' : 'updater'].model }));
    await nodeDriver.run(flow.host.nodes, id, connection(stage === 'writing' ? 'writing' : 'updater')); await checkpoint(stage, nodeDriver);
  }
  const text = (await flow.nodes.read()).ledger.jobs.find(j => j.id === id).text;
  await save('chinese.md', `# 正式链路当前场景（测试档）\n\n${text.lines.map(l => `${l.speaker === 'narrator' ? '' : l.speaker + '[' + l.emotion + ']：'}${l.text}`).join('\n\n')}\n\n【可选回应】\n\n${text.choices.map((c, i) => `${i + 1}. ${c}`).join('\n')}\n`);
  await formalRead(f, id); // The tester chooses index 0, never on behalf of a real player.
  for (let steps = 0; !airpGameView(f.raw())?.boundary && steps < 120; steps++) {
    await f.send(nextD5PlayCommand(AIRP_GAME_CATALOG, f.raw())); commands++;
    if (steps % 8 === 0) await new Promise(resolve => setTimeout(resolve, 0));
  }
  assert(airpGameView(f.raw())?.boundary, 'Real action boundary not reached');
  const taskId = await flow.settle(id);
  console.log(sanitize({ event: 'formal-request', stage: 'settlement', model: config.models.updater.model }));
  await settlementDriver.run(flow.host.settlement, taskId, connection('updater')); await checkpoint('settlement', settlementDriver);
  await flow.nodes.complete(id); await flow.sync();
  const exported = await f.runtime.application.exportSave('formal-airp'); assert(exported.ok);
  assert.deepEqual(readD5Archive(exported.archive, AIRP_GAME_CATALOG, D5_RUN_READERS), f.raw());
  await settlementDriver.run(flow.host.settlement, taskId, connection('updater'));
  await nodeDriver.run(flow.host.nodes, id, connection('writing')); assert.equal(calls, 4);
  const before = f.raw().head.revision;
  if (!airpGameView(f.raw())?.node && f.raw().snapshot.run) await f.send(nextD5PlayCommand(AIRP_GAME_CATALOG, f.raw()));
  await save('formal-save.json', { archiveVersion: 4, record: f.raw() });
  await save('acceptance.json', { classification, calls, cumulative: expected + calls, commands, settledNode: id, testerSelectedIndex: 0, continuationCommitted: f.raw().head.revision > before, memories: f.raw().airpGame.settlement.memories, nextNode: airpGameView(f.raw())?.node?.id ?? null });
  console.log(sanitize({ event: 'formal-complete', calls, cumulative: expected + calls, directory }));
} catch (error) { console.log(sanitize({ event: 'formal-stopped', reason: String(error?.message ?? 'failed').split('\n')[0], directory })); process.exitCode = 1; }
finally { await vite.close(); }

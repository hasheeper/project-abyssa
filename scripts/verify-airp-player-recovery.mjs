/** Player save + HTTP adapter against a restarted native AIRP host; temporary data and fake models only. */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { poolTestRuntime, readPoolConversation } from '../src/game-application/testing/airp-pool-playthrough.ts';
import { firstOnlineOffer, onlineReturnGate } from '../src/game-application/testing/airp-online-playthrough.ts';
import { runAirpOnlineStep, nextAirpOnlineWork } from '../src/game-runtime/airp-online-driver.ts';
import { createAirpRpHttpClient } from '../src/game-infrastructure/airp/rp-http-client.ts';

const argument = process.argv.indexOf('--rp-root');
if (argument < 0 || !process.argv[argument + 1]) throw Error('Pass --rp-root /absolute/path/to/rp-style-lab');
const rpRoot = resolve(process.argv[argument + 1]);
assert.equal(JSON.parse(await readFile(resolve(rpRoot, 'package.json'), 'utf8')).name, 'rp-style-lab');
const { createAirpFixture } = await import(pathToFileURL(resolve(rpRoot, 'server/test/support/application-packages/airp-fixture.ts')).href);
const fixturePath = process.env.ABYSSA_AIRP_ONLINE_FIXTURE;
const gate = fixturePath ? JSON.parse(await readFile(fixturePath, 'utf8')).gate : await onlineReturnGate(await firstOnlineOffer());
const results = [];
for (const stage of ['writer', 'updater']) {
  const game = poolTestRuntime(gate), f = await createAirpFixture(), gateway = f.runtime.fakeProviders.primary;
  const pauseKey = `player-${stage}-restart`;
  let abandoned;
  try {
    assert.equal((await game.runtime.application.open(gate.head.saveId)).ok, true);
    const transport = async (url, init) => {
      const target = new URL(String(url));
      const response = await f.runtime.app.inject({ method: init.method, url: target.pathname + target.search,
        ...(init.body ? { payload: JSON.parse(String(init.body)) } : {}), headers: { accept: 'application/json' } });
      return new Response(response.body, { status: response.statusCode, headers: { 'content-type': 'application/json' } });
    };
    const makeClient = options => createAirpRpHttpClient({ ...options, fetch: transport });
    const baseUrl = 'http://127.0.0.1/api/v1', release = await makeClient({ baseUrl }).release(f.created.release.id);
    const step = () => runAirpOnlineStep({ read: game.read, commit: game.send }, new AbortController().signal, {
      client: makeClient, lock: async (_key, signal, run) => { signal.throwIfAborted(); return run(); },
    });
    const entry = record => record.airpOnline.entries.at(-1);
    await game.send({ type: 'airp-online-connect', baseUrl, release }); await step();
    let record = await game.read();
    record = await game.send({ type: 'airp-online-request', sceneId: entry(record).sceneId });
    const requested = structuredClone(record), requestId = entry(record).ticket.request.requestId;
    const body = { creationRecord: '只使用已提交的取回药箱事实。', lines: [
      { speaker: 'elora', emotion: 'wry', text: '搭扣还在。先放这里吧。' },
    ] };
    gateway.scripts = [
      { chunks: ['检查搭扣，再回应。'] },
      { chunks: [body.lines.map(line => line.text).join('\n')], ...(stage === 'writer' ? { pauseAfterChunks: 0, pauseKey } : {}) },
      { chunks: [JSON.stringify(body)] },
      { chunks: [JSON.stringify({ version: 'state-patch-model-output-v1', operations: [{ op: 'set', path: `/memories/${requestId}/summary`, value: '艾洛拉已经检查归还药箱的搭扣。' }] })], ...(stage === 'updater' ? { pauseAfterChunks: 0, pauseKey } : {}) },
    ];
    if (stage === 'updater') { await step(); await readPoolConversation(game); }
    const beforeRestart = await game.read();
    abandoned = step().then(() => ({ ok: true }), error => ({ ok: false, code: error.code }));
    await gateway.waitForGate(pauseKey);
    const calls = gateway.calls.length;
    await f.restart();
    assert.equal(f.runtime.recoveredRunCount, 0, 'Graceful HTTP shutdown cancels its runs before closing the database');
    assert.equal((await abandoned).ok, false);
    assert.deepEqual(await game.read(), beforeRestart, 'An interrupted HTTP step cannot rewrite the durable player record');
    await assert.rejects(step, error => error.code === 'airp-incomplete');
    assert.equal(gateway.calls.length, calls, 'Replaying an interrupted native action must not rerun a model');
    if (stage === 'writer') {
      record = await game.send({ type: 'airp-online-handwritten', sceneId: entry(requested).sceneId });
      const authored = structuredClone(record.narrative);
      await step(); // obtain the interrupted candidate receipt and freeze cleanup identity
      await step(); // native discard; no body or memory admitted
      record = await game.read();
      assert.equal(entry(record).source, 'handwritten'); assert.equal(entry(record).accepted, null);
      assert.equal(entry(record).control.action, 'discard-scene'); assert.ok(entry(record).controlReceipt);
      assert.equal(nextAirpOnlineWork(record.airpOnline), null);
      assert.deepEqual(record.narrative, authored);
      assert.equal(f.state(entry(record).controlReceipt).pending, ''); assert.equal(f.state(entry(record).controlReceipt).memories.length, 0);
    } else {
      record = await game.read();
      assert.equal(record.narrative.reading.completed, true); assert.equal(entry(record).source, 'generated');
      assert.equal(entry(record).controlReceipt, null); assert.equal(nextAirpOnlineWork(record.airpOnline).kind, 'control');
      record = await game.send({ type: 'airp-turn-in', instanceId: entry(record).instanceId });
      const rejected = await game.runtime.application.dispatch({ protocolVersion: 4, saveId: record.head.saveId, expectedHead: record.head,
        clientRequestId: 'no-followup-after-interruption', command: { type: 'airp-online-followup', instanceId: entry(record).instanceId } });
      assert.equal(rejected.ok, false); assert.deepEqual((await game.read()).snapshot.campaign.funds, beforeRestart.snapshot.campaign.funds);
    }
    await f.restart(); assert.equal(f.runtime.recoveredRunCount, 0); assert.equal(gateway.calls.length, calls);
    results.push({ stage, status: 'passed', simulatedModelCalls: calls, realProviderCalls: 0 });
  } finally { gateway.releaseGate(pauseKey); await abandoned; await f.runtime.cleanup(); }
}
console.log(JSON.stringify({ check: 'native writer/updater restart -> player persistence -> exact replay -> explicit fallback cleanup or blocked dependent generation', results }));

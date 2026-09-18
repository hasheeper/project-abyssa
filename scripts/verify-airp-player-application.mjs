/** Actual player commands -> native AIRP host -> original AVG reading -> confirmed memory. */
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
const game = poolTestRuntime(gate);
assert.equal((await game.runtime.application.open(gate.head.saveId)).ok, true, 'Never trust an unvalidated saved projection');
const f = await createAirpFixture();
try {
  const transport = async (url, init) => {
    const target = new URL(String(url));
    const response = await f.runtime.app.inject({ method: init.method, url: target.pathname + target.search,
      ...(init.body ? { payload: JSON.parse(String(init.body)) } : {}), headers: { accept: 'application/json' } });
    return new Response(response.body, { status: response.statusCode, headers: { 'content-type': 'application/json' } });
  };
  const makeClient = options => createAirpRpHttpClient({ ...options, fetch: transport });
  const baseUrl = 'http://127.0.0.1/api/v1';
  const release = await makeClient({ baseUrl }).release(f.created.release.id);
  const port = { read: game.read, commit: game.send };
  const step = () => runAirpOnlineStep(port, new AbortController().signal, { client: makeClient, lock: async (_key, signal, run) => { signal.throwIfAborted(); return run(); } });
  const currentEntry = record => record.airpOnline.entries.at(-1);
  f.runtime.fakeProviders.primary.scripts = [];
  await game.send({ type: 'airp-online-connect', baseUrl, release });
  await step();
  let record = await game.read();
  const binding = record.airpOnline.connection.binding;
  assert.notEqual(binding.sessionId, f.session.session.id, 'Development and player instances must be isolated');
  const sourceFunds = structuredClone(record.snapshot.campaign.funds);
  let interruptedArchive;
  const summaries = ['艾洛拉检查了归还药箱的搭扣，请玩家不要拿它碰石头。', '艾洛拉再谈搭扣，说明已经收好药箱。'];
  for (const [index, task] of ['return', 'followup'].entries()) {
    if (index) await game.send({ type: 'airp-online-followup', instanceId: currentEntry(record).instanceId });
    record = await game.read();
    record = await game.send({ type: 'airp-online-request', sceneId: currentEntry(record).sceneId });
    const ticket = currentEntry(record).ticket;
    if (!index) interruptedArchive = structuredClone(record);
    assert.equal(ticket.request.task, task);
    assert.deepEqual(ticket.request.source.head, record.head);
    const text = { creationRecord: '已知：药箱已取回。保持艾洛拉视角，不替玩家决定行动。', lines: [
      { speaker: 'elora', emotion: index ? 'confident' : 'wry', text: index ? '刚才说过的搭扣，我已经扣好了。药箱在原处。' : '这回搭扣没有散开。先放这里，别再拿它碰石头。' },
      { speaker: 'narrator', emotion: 'neutral', text: '她把手边的软布叠好，留出放药箱的位置。' },
    ] };
    f.runtime.fakeProviders.primary.scripts.push(
      { chunks: ['先检查搭扣，再回应玩家；只用已确认的共同记忆。'] },
      { chunks: [text.lines.map(line => line.text).join('\n')] },
      { chunks: [JSON.stringify(text)] },
      { chunks: [JSON.stringify({ version: 'state-patch-model-output-v1', operations: [{ op: 'set', path: `/memories/${ticket.request.requestId}/summary`, value: summaries[index] }] })] },
    );
    await step(); record = await game.read();
    let entry = currentEntry(record);
    assert.equal(entry.source, 'generated');
    assert.equal(entry.control, null, 'Displaying text is not a completed reading');
    assert.equal(record.narrative.scenes.find(s => s.id === entry.sceneId).source, 'rp');
    assert.equal(nextAirpOnlineWork(record.airpOnline), null);
    await step(); assert.equal(f.runtime.fakeProviders.primary.calls.length, index * 4 + 3);
    assert.deepEqual(record.snapshot.campaign.funds, sourceFunds);
    for (const offset of [0, 1]) {
      const input = f.runtime.fakeProviders.primary.calls[index * 4 + offset].messages.map(message => message.content).join('\n');
      assert.match(input, /source-slice-v1/);
      assert.match(input, /主大陆偏远海崖/);
      assert.doesNotMatch(input, /凯尔|法则中枢|防御阵法|政治楔子|安神物件/);
      if (offset) assert.match(input, /一屏只推进一个反应/);
      else assert.doesNotMatch(input, /一屏只推进一个反应/);
    }
    if (index) assert.match(JSON.stringify(f.runtime.fakeProviders.primary.calls[4]), /不要拿它碰石头/);
    await readPoolConversation(game); record = await game.read(); entry = currentEntry(record);
    assert.equal(entry.control.action, 'confirm-scene');
    assert.deepEqual(entry.control.payload.factIds, [record.facts.at(-1).id]);
    await step(); record = await game.read(); entry = currentEntry(record);
    const memory = f.state(entry.controlReceipt).memories;
    assert.equal(memory.length, index + 1);
    assert.equal(memory.at(-1).summary, summaries[index]);
    assert.equal(f.snapshot(entry.controlReceipt).restorable, true);
    await step(); assert.equal(f.runtime.fakeProviders.primary.calls.length, (index + 1) * 4);
    assert.equal((await game.runtime.application.open(gate.head.saveId)).ok, true);
    if (!index) record = await game.send({ type: 'airp-turn-in', instanceId: entry.instanceId });
  }
  assert.deepEqual(record.snapshot.campaign.funds, sourceFunds);
  assert.equal(record.airpOnline.entries.filter(e => e.controlReceipt).length, 2);
  // Another installation can restore the exact identity, but cannot overwrite its newer local save.
  const restored = poolTestRuntime();
  assert.equal((await restored.runtime.application.restoreSave({ archive: JSON.stringify({ archiveVersion: 4, record: interruptedArchive }), clientRequestId: 'recover-native-player' })).ok, true);
  const recoveredPort = { read: restored.read, commit: restored.send };
  const recoverStep = () => runAirpOnlineStep(recoveredPort, new AbortController().signal, { client: makeClient, lock: async (_key, _signal, run) => run() });
  await recoverStep(); await readPoolConversation(restored); await recoverStep();
  const recovered = await restored.read();
  assert.equal(currentEntry(recovered).controlReceipt.floorId, record.airpOnline.entries[0].controlReceipt.floorId);
  assert.equal(f.runtime.fakeProviders.primary.calls.length, 8, 'Restoring a lost-response archive must replay its exact native history, not rerun models');
  assert.equal((await game.runtime.application.restoreSave({ archive: JSON.stringify({ archiveVersion: 4, record: interruptedArchive }), clientRequestId: 'do-not-overwrite-newer' })).ok, false);
  console.log(JSON.stringify({ check: 'actual patrol -> isolated native Session -> frozen AVG -> real reading -> confirmed memory -> recall; exact-identity interrupted archive replay, newer local save preserved', status: 'passed', simulatedModelCalls: f.runtime.fakeProviders.primary.calls.length, realProviderCalls: 0 }));
} finally { await f.runtime.cleanup(); }

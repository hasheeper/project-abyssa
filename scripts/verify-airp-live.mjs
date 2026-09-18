/** Opt-in paid acceptance run. Uses the actual player application and native rp HTTP client. */
import assert from 'node:assert/strict';
import { mkdir, open, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { poolTestRuntime, readPoolConversation } from '../src/game-application/testing/airp-pool-playthrough.ts';
import { runAirpOnlineStep, nextAirpOnlineWork } from '../src/game-runtime/airp-online-driver.ts';
import { createAirpRpHttpClient } from '../src/game-infrastructure/airp/rp-http-client.ts';
import { prepareAirpSession } from '../src/game-application/airp/rp-session.ts';
import { readAirpLiveBudget, reserveAirpLiveStep } from './airp-live-budget.mjs';

function option(name) {
  const index = process.argv.indexOf(name);
  if (index < 0 || !process.argv[index + 1]) throw Error(`Required: ${name}`);
  return process.argv[index + 1];
}
if (!process.argv.includes('--allow-live')) throw Error('Real model calls require --allow-live');
const baseUrl = option('--base-url'), releaseId = option('--release-id');
const out = resolve(option('--out')), fixture = resolve(option('--fixture'));
// Reserve the worst-case next step against native attempts already spent, including failures.
// A continuation can lower each case cap to include earlier cancelled test identities in the total.
const maxModelCalls = Number(option('--max-model-calls'));
assert.ok(Number.isInteger(maxModelCalls) && maxModelCalls > 0 && maxModelCalls <= 12, 'Each two-scene case must be capped at 12 or fewer calls');
await mkdir(out, { recursive: true });
// Refuse overlapping runners. A crash leaves a visible lock for deliberate recovery.
const lockPath = resolve(out, 'runner.lock'), lock = await open(lockPath, 'wx');
await lock.writeFile(String(process.pid));
const jsonFile = async (name, data) => {
  const file = resolve(out, name), temporary = `${file}.next`;
  await writeFile(temporary, JSON.stringify(data, null, 2));
  await rename(temporary, file);
};
try {
  let journal;
  try { journal = JSON.parse(await readFile(resolve(out, 'journal.json'), 'utf8')); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (!journal) journal = { version: 1, baseUrl, releaseId, startedAt: new Date().toISOString(), steps: [], developmentBinding: null, record: JSON.parse(await readFile(fixture, 'utf8')).gate };
  assert.equal(journal.baseUrl, baseUrl); assert.equal(journal.releaseId, releaseId);
  journal.maxModelCalls ??= maxModelCalls;
  assert.equal(journal.maxModelCalls, maxModelCalls, 'Never silently increase a resumed paid run budget');
  journal.reservedModelCalls ??= journal.steps.reduce((sum, step) => sum + (step.kind === 'generate' ? 4 : step.kind === 'control' ? 2 : 0), 0);
  const game = poolTestRuntime(journal.record);
  assert.equal((await game.runtime.application.open(journal.record.head.saveId)).ok, true, 'Fixture/resumed record must pass full replay validation');
  const save = async () => { journal.record = await game.read(); await jsonFile('journal.json', journal); };
  const archiveOnce = async name => {
    try { await writeFile(resolve(out, name), JSON.stringify({ archiveVersion: 4, record: journal.record }), { flag: 'wx' }); }
    catch (error) { if (error.code !== 'EEXIST') throw error; }
  };
  const send = async command => { const record = await game.send(command); await save(); return record; };
  const reader = { ...game, send };
  await save();
  const client = createAirpRpHttpClient({ baseUrl }), release = await client.release(releaseId);
  await jsonFile('release.json', release);
  if (!journal.record.airpOnline.connection) await send({ type: 'airp-online-connect', baseUrl, release });
  // Development and player use identical frozen resources but different native Sessions.
  if (!journal.developmentBinding) {
    const ticket = prepareAirpSession(release, { ...journal.record.airpOnline.connection.ticket.identity, mode: 'development' });
    journal.developmentBinding = await client.createSession(ticket); await save();
  }
  const step = async () => {
    const work = nextAirpOnlineWork((await game.read()).airpOnline);
    assert.ok(work, 'Expected durable native work');
    const nativeBudget = await readAirpLiveBudget(baseUrl, (await game.read()).airpOnline.connection.binding);
    const reservation = reserveAirpLiveStep(nativeBudget, work.kind, maxModelCalls);
    journal.observedModelCalls = nativeBudget.modelCalls;
    journal.reservedModelCalls = reservation.reservedCeiling;
    const timing = { ...work, ...reservation, startedAt: new Date().toISOString(), status: 'running' };
    journal.steps.push(timing); await save(); console.log(JSON.stringify(timing));
    const started = performance.now();
    try {
      await runAirpOnlineStep({ read: game.read, commit: send }, new AbortController().signal, {
        lock: async (_key, signal, run) => { signal.throwIfAborted(); return run(); },
      });
      timing.status = 'passed';
    } catch (error) { timing.status = 'failed'; timing.error = error.code ?? error.name; throw error; }
    finally { timing.elapsedMs = Math.round(performance.now() - started); await save(); console.log(JSON.stringify(timing)); }
  };
  if (!journal.record.airpOnline.connection.binding) await step();
  assert.notEqual(journal.record.airpOnline.connection.binding.sessionId, journal.developmentBinding.sessionId);
  journal.sourceFunds ??= structuredClone(journal.record.snapshot.campaign.funds); await save();
  const current = () => journal.record.airpOnline.entries.at(-1);
  for (const task of ['return', 'followup']) {
    let entry = journal.record.airpOnline.entries.find(e => e.ticket?.request.task === task);
    if (!entry) {
      if (task === 'followup') {
        const instanceId = current().instanceId;
        const instance = journal.record.narrative.instances.find(i => i.id === instanceId);
        if (instance.status === 'ready') await send({ type: 'airp-turn-in', instanceId });
        if (journal.record.airpOnline.entries.length === 1) await send({ type: 'airp-online-followup', instanceId });
      }
      await send({ type: 'airp-online-request', sceneId: current().sceneId });
      entry = current();
    }
    if (entry.source === 'requested') await step();
    entry = journal.record.airpOnline.entries.find(e => e.ticket?.request.task === task);
    assert.equal(entry.source, 'generated', 'Handwritten fallback is not a passed real-model sample');
    if (!entry.control) {
      await archiveOnce(`${task}-unread-save.json`);
      await readPoolConversation(reader); await save();
    }
    entry = journal.record.airpOnline.entries.find(e => e.ticket?.request.task === task);
    assert.equal(entry.control.action, 'confirm-scene');
    if (!entry.controlReceipt) await step();
    assert.deepEqual(journal.record.snapshot.campaign.funds, journal.sourceFunds);
    assert.equal((await game.runtime.application.open(journal.record.head.saveId)).ok, true);
    await archiveOnce(`${task}-confirmed-save.json`);
  }
  assert.equal(journal.record.airpOnline.entries.filter(e => e.controlReceipt).length, 2);
  const finalBudget = await readAirpLiveBudget(baseUrl, journal.record.airpOnline.connection.binding);
  reserveAirpLiveStep(finalBudget, 'session', maxModelCalls);
  journal.observedModelCalls = finalBudget.modelCalls;
  journal.reservedModelCalls = finalBudget.modelCalls;
  journal.status = 'passed'; journal.completedAt = new Date().toISOString(); await save();
  console.log(JSON.stringify({ status: journal.status, out, sessionId: journal.record.airpOnline.connection.binding.sessionId, steps: journal.steps }));
} finally { await lock.close(); await unlink(lockPath); }

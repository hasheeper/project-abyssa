/** Build independent acceptance identities through legitimate game commands; never edit a snapshot. */
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { poolTestRuntime, readPoolConversation } from '../src/game-application/testing/airp-pool-playthrough.ts';
import { nextD5PlayCommand } from '../src/game-application/testing/d5-playthrough.ts';
import { AIRP_ONLINE_CATALOG } from '../src/game-runtime/airp-context.ts';

const [fixturePath, outPath, runTag = 'live031'] = process.argv.slice(2);
if (!fixturePath || !outPath) throw Error('Usage: prepare-airp-live-cases.mjs <validated-checkpoints.json> <new-output-directory> [run-tag]');
assert.match(runTag, /^[a-z][a-z0-9-]{0,40}$/, 'Use a short explicit acceptance identity');
const out = resolve(outPath), fixture = JSON.parse(await readFile(resolve(fixturePath), 'utf8'));
const source = fixture.gate.originRef.source;
assert.equal(source.schemaVersion, 4);
await mkdir(out, { recursive: true });
for (const [outcome, option, stance] of [['extracted', 'C', 'pragmatic'], ['cleared', 'B', 'seasoned']]) {
  const f = poolTestRuntime(source);
  assert.equal((await f.runtime.application.open(source.head.saveId)).ok, true);
  const continued = await f.runtime.application.continueSave({ sourceSaveId: source.head.saveId, expectedSourceHead: source.head, saveId: 'pool', epoch: `${runTag}-${outcome}-20260912`, clientRequestId: `${runTag}-upgrade-${outcome}`, kind: 'upgrade', contentVersion: 10 });
  assert.equal(continued.ok, true);
  let r = await f.read();
  const instanceId = r.narrative.instances.find(i => i.definition.id === 'ripple.elora.old-medicine-case').id;
  await f.send({ type: 'airp-open', instanceId }); await readPoolConversation(f, option);
  r = await f.send({ type: 'start-expedition', runId: `${runTag}-${outcome}`, routeId: 'old-manor.maintenance', partyIds: AIRP_ONLINE_CATALOG.data.initialParty, itemIds: AIRP_ONLINE_CATALOG.data.journey.defaultItems, seed: 19 });
  for (let step = 0; r.snapshot.run && step < 700; step++) {
    const command = nextD5PlayCommand(AIRP_ONLINE_CATALOG, r);
    r = await f.send(command.type === 'choose-exit' && outcome === 'extracted' ? { ...command, choice: 'leave' } : command);
  }
  assert.equal(r.snapshot.run, null);
  assert.equal(r.snapshot.campaign.settlements.at(-1).outcome, outcome);
  assert.equal(r.narrative.instances.find(i => i.id === instanceId).status, 'ready');
  const gate = await f.send({ type: 'airp-open', instanceId });
  assert.equal((await f.runtime.application.open(gate.head.saveId)).ok, true);
  assert.equal(gate.airpOnline.connection, null);
  await writeFile(resolve(out, `${outcome}-fixture.json`), JSON.stringify({ outcome, option, stance, gate }), { flag: 'wx' });
  console.log(JSON.stringify({ outcome, option, stance, head: gate.head, facts: gate.facts.length, realProviderCalls: 0 }));
}

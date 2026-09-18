/** Real AIRP Application Package + native host + Abyssa client; temporary data and fake models only. */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { airpOnlineFixture } from '../src/game-application/testing/airp-online-fixture.ts';
import { prepareAirpScene, acceptAirpScene } from '../src/game-application/airp/acceptance.ts';
import { prepareAirpConfirmationTicket, prepareAirpDiscardTicket } from '../src/game-application/airp/control.ts';
import { prepareAirpSession } from '../src/game-application/airp/rp-session.ts';
import { createAirpRpHttpClient } from '../src/game-infrastructure/airp/rp-http-client.ts';
const argument = process.argv.indexOf('--rp-root');
if (argument < 0 || !process.argv[argument + 1]) throw new Error('Pass --rp-root /absolute/path/to/rp-style-lab');
const rpRoot = resolve(process.argv[argument + 1]);
assert.equal(JSON.parse(await readFile(resolve(rpRoot, 'package.json'), 'utf8')).name, 'rp-style-lab');
const { createAirpFixture } = await import(pathToFileURL(resolve(rpRoot, 'server/test/support/application-packages/airp-fixture.ts')).href);
const f = await createAirpFixture();
try {
  const sample = airpOnlineFixture();
  f.runtime.fakeProviders.primary.scripts = [
    { chunks: ['检查搭扣，再回应。'] }, { chunks: [sample.text.lines.map(line => line.text).join('\n')] }, { chunks: [JSON.stringify(sample.text)] },
    { chunks: [JSON.stringify({ version: 'state-patch-model-output-v1', operations: [{ op: 'set', path: `/memories/${sample.request.requestId}/summary`, value: '艾洛拉检查药箱搭扣，提醒不要拿它碰石头。' }] })] },
    { chunks: ['承接已经检查过搭扣的记忆。'] }, { chunks: [sample.text.lines.map(line => line.text).join('\n')] }, { chunks: [JSON.stringify(sample.text)] },
  ];
  const transport = async (url, init) => {
    const target = new URL(String(url));
    const response = await f.runtime.app.inject({ method: init.method, url: target.pathname + target.search,
      ...(init.body ? { payload: JSON.parse(String(init.body)) } : {}), headers: { accept: 'application/json' } });
    return new Response(response.body, { status: response.statusCode, headers: { 'content-type': 'application/json' } });
  };
  const client = createAirpRpHttpClient({ baseUrl: 'http://127.0.0.1/api/v1', fetch: transport });
  const release = await client.release(f.created.release.id);
  assert.equal(release.writingPipelineVersionId, f.versionOf('pipeline.formatting'), 'The current package must bind the final formatter, not the literary writer or reformatter');
  assert.notEqual(release.writingPipelineVersionId, f.versionOf('pipeline.writing'));
  assert.notEqual(release.writingPipelineVersionId, f.versionOf('pipeline.reformatting'));
  const sessionTicket = prepareAirpSession(release, { saveId: sample.request.source.head.saveId, epoch: sample.request.source.head.epoch, mode: 'play', content: sample.request.source.content });
  const binding = await client.createSession(sessionTicket);
  assert.notEqual(binding.sessionId, f.session.session.id, 'Player must not use the development fixture Session');
  assert.deepEqual(await client.recoverSession(sessionTicket), binding);
  assert.deepEqual(await client.createSession(sessionTicket), binding, 'Sequential lost-response recovery must not create another Session');
  const ticket = prepareAirpScene(binding, sample.request);
  const result = await client.generate(ticket), accepted = acceptAirpScene(ticket, result, sample.current);
  assert.equal(accepted.result.origin.writingPipelineVersionId, release.writingPipelineVersionId);
  const confirmation = prepareAirpConfirmationTicket(accepted, { completed: true, head: { ...sample.request.source.head, revision: 20 }, factIds: ['fact.case-read'] });
  const receipt = await client.control(confirmation);
  assert.equal(f.snapshot(receipt).restorable, true);
  assert.deepEqual(f.snapshot(receipt).incompleteReasons, []);
  assert.equal(f.state(receipt).memories.length, 1);
  const confirmationReplay = await client.control(confirmation);
  assert.equal(confirmationReplay.floorId, receipt.floorId);
  assert.equal(confirmationReplay.replayed, true);
  assert.equal(f.runtime.fakeProviders.primary.calls.length, 4);
  const followup = { ...sample.request, requestId: 'request.followup.1', task: 'followup', phase: 13, source: { ...sample.request.source, head: { ...sample.request.source.head, revision: 22 } } };
  const nextTicket = prepareAirpScene({ ...binding, head: { floorId: receipt.floorId, checkpointSnapshotId: receipt.checkpointSnapshotId, checkpointContentHash: receipt.checkpointContentHash } }, followup);
  const nextReceipt = await client.submitGeneration(nextTicket);
  const next = await client.readResult(nextTicket, nextReceipt);
  assert.equal(next.requestId, followup.requestId);
  assert.match(JSON.stringify(f.runtime.fakeProviders.primary.calls[4]), /提醒不要拿它碰石头/);
  const discard = prepareAirpDiscardTicket(nextTicket, { floorId: nextReceipt.floorId, checkpointSnapshotId: nextReceipt.checkpointSnapshotId, checkpointContentHash: nextReceipt.checkpointContentHash });
  const discarded = await client.control(discard);
  assert.equal(f.state(discarded).pending, '');
  assert.equal(f.state(discarded).memories.length, 1);
  assert.equal((await client.control(discard)).floorId, discarded.floorId);
  assert.equal((await client.control(confirmation)).floorId, receipt.floorId, 'An old confirmation must replay its frozen source even after the branch advances');
  assert.equal(f.runtime.fakeProviders.primary.calls.length, 7);
  await assert.rejects(() => client.generate(prepareAirpScene(binding, { ...sample.request, requestId: 'stale-head' })));
  assert.equal(f.runtime.fakeProviders.primary.calls.length, 7, 'A stale branch head must fail before model execution');

  // Native output is a string Entry: malformed JSON must not strand an undiscardable candidate.
  const malformedBinding = await client.createSession(prepareAirpSession(release, { ...sessionTicket.identity, mode: 'development' }));
  const malformedRequest = { ...sample.request, mode: 'development', requestId: 'malformed-output' };
  const malformedTicket = prepareAirpScene(malformedBinding, malformedRequest);
  f.runtime.fakeProviders.primary.scripts.push({ chunks: ['outline'] }, { chunks: ['正文'] }, { chunks: ['not JSON'] }, { chunks: ['still not JSON'] });
  const malformedReceipt = await client.submitGeneration(malformedTicket);
  await assert.rejects(() => client.readResult(malformedTicket, malformedReceipt));
  const cleared = await client.control(prepareAirpDiscardTicket(malformedTicket, { floorId: malformedReceipt.floorId, checkpointSnapshotId: malformedReceipt.checkpointSnapshotId, checkpointContentHash: malformedReceipt.checkpointContentHash }));
  assert.equal(f.state(cleared).pending, '');
  assert.equal(f.state(cleared).memories.length, 0);

  const failedBinding = await client.createSession(prepareAirpSession(release, { ...sessionTicket.identity, saveId: 'save.updater-failure', epoch: 'epoch.updater-failure' }));
  const failedRequest = { ...sample.request, requestId: 'required-updater-failure', source: { ...sample.request.source, head: { saveId: 'save.updater-failure', epoch: 'epoch.updater-failure', revision: 18 } } };
  const failedTicket = prepareAirpScene(failedBinding, failedRequest);
  f.runtime.fakeProviders.primary.scripts.push({ chunks: ['outline'] }, { chunks: [sample.text.lines.map(line => line.text).join('\n')] }, { chunks: [JSON.stringify(sample.text)] }, { chunks: [JSON.stringify({ version: 'state-patch-model-output-v1', operations: [] })] });
  const failedScene = acceptAirpScene(failedTicket, await client.generate(failedTicket), { ...sample.current, head: failedRequest.source.head });
  const failedConfirmation = prepareAirpConfirmationTicket(failedScene, { completed: true, head: { ...failedRequest.source.head, revision: 20 }, factIds: ['fact.failed-read'] });
  await assert.rejects(() => client.control(failedConfirmation), error => error.code === 'airp-incomplete');
  const calls = f.runtime.fakeProviders.primary.calls.length;
  await assert.rejects(() => client.control(failedConfirmation), error => error.code === 'airp-incomplete');
  assert.equal(f.runtime.fakeProviders.primary.calls.length, calls, 'Repeating a semantically rejected Updater must not quietly run another model attempt');
  console.log(JSON.stringify({ check: 'Release -> isolated Session -> Workflow -> confirmed memory -> recall; native stale-head, malformed-output/discard and required-updater rejection', status: 'passed', simulatedModelCalls: calls, realProviderCalls: 0,
    packageVersion: f.created.release.manifest.packageLock.packageVersion, packageHash: release.packageHash,
    releaseId: release.releaseId, releaseHash: release.releaseHash, finalPipelineVersionId: release.writingPipelineVersionId }));
} finally { await f.runtime.cleanup(); }

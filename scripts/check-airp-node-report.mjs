// Explicit offline revalidation of preserved CL-D output. Original reports stay untouched.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createServer } from 'vite';

assert(process.argv.length === 3, 'Use <saved-CL-D-report-directory>');
const directory = path.resolve(process.argv[2]);
assert(directory.startsWith(path.join(process.cwd(), 'dist/reports/airp-cl-d-')), 'Expected local CL-D report');
const vite = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false, ws: false, watch: null }, appType: 'custom' });
try {
  const root = JSON.parse(await fs.readFile(path.join(directory, 'development-root.json'), 'utf8'));
  const { nodeFixture } = await vite.ssrLoadModule('/src/game-application/testing/airp-node-fixture.ts');
  const { assertNodeProgramMayAdvance } = await vite.ssrLoadModule('/src/game-application/airp-expedition-play/service.ts');
  const { prepareAirpSettlement } = await vite.ssrLoadModule('/src/game-core/session/index.ts');
  const { nextD5PlayCommand } = await vite.ssrLoadModule('/src/game-application/testing/d5-playthrough.ts');
  const { AIRP_DIRECTOR_CATALOG } = await vite.ssrLoadModule('/src/game-runtime/airp-director-context.ts');
  const f = await nodeFixture(); f.restore(root);
  const s = await f.nodes.read(), job = s.settlement.jobs[0];
  assert.equal(job.status, 'failed'); assert.equal(s.settlement.receipts.length, 0); assert.equal(s.settlement.memories.length, 0);
  assert.throws(() => assertNodeProgramMayAdvance(s), /Pending settlement/);
  const attempts = [];
  for (const a of job.attempts) {
    const frame = job.frames[a.frame];
    const proposal = JSON.parse(a.output);
    const prepared = prepareAirpSettlement(frame.input, proposal, { head: frame.input.state.head, receipts: frame.input.priorReceipts, appliedItemOperations: [] });
    assert.equal(prepared.status, 'prepared');
    const originals = [...proposal.memory.points, ...proposal.memory.open];
    const admitted = [...prepared.batch.memory.points, ...prepared.batch.memory.opened];
    for (let i = 0; i < originals.length; i++) {
      assert.equal(admitted[i].text, originals[i].text);
      assert.deepEqual(admitted[i].basisIds, originals[i].basisIds);
    }
    assert(admitted.some(p => p.kind === 'record'));
    assert.equal(prepared.batch.effects.length, 0);
    attempts.push({ id: a.id, historicalStatus: a.status, revalidatedStatus: 'prepared', records: admitted.filter(p => p.kind === 'record').length });
  }
  console.log(JSON.stringify({ event: 'offline-originals-admitted', attempts, networkCalls: 0 }));
  await f.settlement.revalidate(job.id); await f.settlement.apply(job.id);
  const node = s.ledger.jobs[0]; await f.nodes.complete(node.id);
  assert.deepEqual(f.raw().settlement.jobs[0].attempts, job.attempts);
  assert.deepEqual(f.raw().nodes.jobs[0].text, node.text); assert.deepEqual(f.raw().nodes.jobs[0].reads, node.reads);
  assert.equal(f.raw().settlement.receipts.length, 1); assert.equal(f.raw().settlement.memories.length, 1);
  const committed = f.raw(); f.restore(committed);
  await f.settlement.revalidate(job.id); await f.settlement.apply(job.id);
  assert.deepEqual(f.raw(), committed); // No duplicate commits, effects, calls, or invented attempts.
  const resumed = await f.nodes.read();
  assert.doesNotThrow(() => assertNodeProgramMayAdvance(resumed));
  const destination = await fs.mkdtemp(path.join(process.cwd(), 'dist/reports/airp-cl-d-revalidated-'));
  await fs.chmod(destination, 0o700);
  const save = (name, data) => fs.writeFile(path.join(destination, name), JSON.stringify(data, null, 2), { mode: 0o600 });
  await save('admitted-root.json', committed);
  let commands = 0;
  while (commands < 140 && !(await f.nodes.read()).program.slotIds.includes('slot:1:0:cleared')) {
    await f.send(nextD5PlayCommand(AIRP_DIRECTOR_CATALOG, f.raw().gameplay)); commands++;
  }
  assert((await f.nodes.read()).program.slotIds.includes('slot:1:0:cleared'));
  await f.nodes.sync(); const next = f.raw().nodes.jobs[1]; await f.nodes.open(next.id);
  const frame = f.raw().nodes.jobs[1].frame;
  assert(frame.scene.userInput.includes(node.text.lines.find(l => l.speaker !== 'narrator').text));
  assert(frame.scene.userInput.includes(node.text.choices[0]));
  assert.deepEqual(JSON.parse(await fs.readFile(path.join(directory, 'development-root.json'), 'utf8')), root);
  await save('next-input.json', frame); await save('development-root.json', f.raw());
  const report = { result: 'original-output-revalidated-and-continued', source: directory, destination, networkCalls: 0, attempts,
    historicalAttemptsUnchanged: true, originalTextAndCitationsUnchanged: true, readableLines: node.text.lines.length, readLines: node.reads.length,
    warnings: node.writingWarnings, appliedReceipts: 1, memories: 1, openThreads: committed.settlement.openThreads.length, variableEffects: 0,
    continuationBlocked: false, actualProgramCommands: commands, firstRoomCleared: true, nextInputReady: true, nextNodeGenerated: false,
    classification: 'original-real-Low-and-settlement/offline-revalidation/real-D5-clear/mock-GM/development-owner/no-final-drop-adapter' };
  await save('report.json', report); console.log(JSON.stringify(report));
} finally { await vite.close(); }

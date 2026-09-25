// Offline S4 evidence: replay the retained archive and reproduce only its pending apply, in memory.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {isDeepStrictEqual} from 'node:util';
import {createServer} from 'vite';
import {compactReportArchive} from './lib/airp-report-archive.mjs';

assert.equal(process.argv.length, 3, 'Use <isolated CL-F report directory>');
const directory = path.resolve(process.argv[2]);
assert(path.dirname(directory) === path.resolve('dist/reports') && path.basename(directory).startsWith('airp-cl-f-'));
const vite = await createServer({configFile: false, server: {middlewareMode: true, hmr: false, ws: false, watch: null}, appType: 'custom'});
try {
  const load = name => vite.ssrLoadModule(`/src/${name}.ts`);
  const {parseTestConfig} = await load('game-infrastructure/airp-direct/test-config');
  const config = parseTestConfig(await fs.readFile('config/airp-test.local.json', 'utf8'));
  const keys = Object.values(config.keys).filter(Boolean), endpoints = [...new Set(Object.values(config.models).map(m => m.baseUrl))].sort((a, b) => b.length - a.length);
  const meta = JSON.parse(await fs.readFile(path.join(directory, 'run.json'), 'utf8'));
  let archive = await fs.readFile(path.join(directory, 'formal-save.json'), 'utf8');
  assert(!keys.some(k => archive.includes(k)));
  endpoints.forEach((url, i) => {archive = archive.replaceAll(`[configured-endpoint:${i}]`, url);});
  const {readD5Archive} = await load('game-application/versions/d5-validate');
  const {SHOP_AIRP_CATALOG} = await load('game-runtime/shop-wave-context');
  const {D5_RUN_READERS} = await load('game-core/session/index');
  const {DATA_LIMITS} = await load('game-core/contracts/validation');
  const {lowCanonicalChinese} = await load('game-application/airp-low/output');
  const {compileSceneGM} = await load('game-application/airp-director/scene-gm');
  const r = readD5Archive(compactReportArchive(archive), SHOP_AIRP_CATALOG, D5_RUN_READERS);
  assert.equal(meta.contextVersion, 19); assert.equal(meta.completed, false);
  const event = r.airpDirector.events.find(e => e.id === meta.eventId), settlement = r.airpGame.settlement, pending = settlement.jobs.at(-1);
  assert.equal(event.status, 'resolved'); assert.equal(event.delivery.status, 'confirmed'); assert.equal(r.snapshot.run, null);
  assert.equal(pending.status, 'ready'); assert.equal(pending.attempts.at(-1).status, 'succeeded');
  assert(settlement.jobs.slice(0, -1).every(j => j.status === 'applied'));
  const scenes = r.airpDirector.jobs.filter(j => j.kind === 'scene'), nodes = Object.values(r.airpGame.nodes).flatMap(n => n.jobs);
  for (const j of scenes) {
    assert.deepEqual(j.attempts.map(a => a.stage), ['writing', 'formatting', 'scene-evaluate']);
    assert(j.attempts.every(a => a.status === 'succeeded'));
    const source = r.airpDirector.materials[j.materialHash].resources.sources, request = compileSceneGM(j, 'scene-evaluate', source);
    for (const ref of j.gmContext.documents) assert(request.messages.some(m => m.content.includes(source.find(s => s.id === ref.id && s.sha256 === ref.sha256).text)));
    assert.deepEqual(j.text.lines, lowCanonicalChinese(j.attempts[0].output, j.lowFrame));
    assert(event.readSceneIds.includes(j.id));
  }
  assert(nodes.every(j => j.status === 'completed' && j.reads.length === j.text.lines.length));
  const terminal = r.facts.filter(f => f.kind === 'progression' && f.payload.type === 'expedition-settled').at(-1).payload.terminal;
  assert.equal(terminal.outcome, 'extracted'); assert.equal(terminal.deepestLayer, 3);
  const attempts = [...scenes.flatMap(j => j.attempts), ...r.airpGame.gm.jobs.flatMap(j => j.attempts), ...nodes.flatMap(j => j.attempts), ...settlement.jobs.flatMap(j => j.attempts)];
  assert.equal(attempts.length, meta.calls); // Initial day is the explicitly labelled fixture.
  assert.equal(meta.history.filter(h => h.request).length, meta.calls);
  const {MemoryGameDatabase, MemoryGameStore} = await load('game-infrastructure/storage/memory');
  const {createPlayerRuntime} = await load('game-runtime/player-runtime');
  const db = new MemoryGameDatabase(); db.records.set(r.head.saveId, r); let serial = 0;
  const runtime = createPlayerRuntime(new MemoryGameStore(db), {newId: () => `s4-check:${++serial}`, newSeed: () => 19, close() {}});
  const flow = runtime.airpGame.forSave(r.head.saveId, 24);
  await assert.rejects(flow.settlement.apply(pending.id), /JSON size limit exceeded/);
  assert.equal(db.records.get(r.head.saveId), r, 'Rejected apply changed the original record');
  const size = value => Buffer.byteLength(JSON.stringify(value));
  const metric = (id, lines) => {
    const chars = l => [...l.text.replace(/\s/g, '')].length, total = lines.reduce((n, l) => n + chars(l), 0);
    return {id, lines: lines.length, chars: total, dialoguePercent: Math.round(1000 * lines.filter(l => l.speaker !== 'narrator').reduce((n, l) => n + chars(l), 0) / total) / 10};
  };
  const normalize = lines => lines.map(l => ({...l, text: /^「[\s\S]*」$/.test(l.text) ? l.text.slice(1, -1) : l.text}));
  const result = {status: 'blocked-at-final-settlement-apply; not full-chain acceptance', technicalReplay: 'passed', networkCallsForThisCheck: 0,
    contentVersion: 24, contextVersion: 19, calls: meta.calls, cumulative: meta.initialCalls + meta.calls + (meta.externalCalls ?? 0),
    reportedTokens: attempts.reduce((n, a) => n + (a.usage.totalTokens ?? 0), 0), unknownUsageCalls: attempts.filter(a => a.usage.totalTokens === null).length,
    archiveBytes: size({archiveVersion: 4, record: r}), limitBytes: DATA_LIMITS.bytes,
    sizes: {facts: size(r.facts), director: size(r.airpDirector), game: size(r.airpGame), settlementFrames: settlement.jobs.map(j => j.frames.map(size))},
    event: {status: event.status, delivery: event.delivery.status}, return: {outcome: terminal.outcome, layer: terminal.deepestLayer, loot: terminal.returnedLoot.length},
    appliedSettlements: settlement.receipts.length, pendingSettlement: {status: pending.status, proposedEffects: pending.prepared.effects, appliedAffinity: settlement.state.affinity},
    applyFailure: {message: '$: JSON size limit exceeded', reproduced: true, recordUnchanged: true}, nextDayGmExecuted: false,
    corrections: [...r.airpDirector.jobs.flatMap(j => j.memoryCorrections ?? []), ...r.airpGame.gm.jobs.flatMap(j => j.memoryCorrections ?? [])],
    sceneEvaluations: scenes.map(j => ({role: j.scene.role, turn: j.scene.dialogue.turn, evaluation: j.sceneGMEvaluation, fidelity: j.lowFidelity})),
    metrics: [...scenes.map(j => metric(`${j.scene.role}:${j.scene.dialogue.turn}`, j.text.lines)), ...nodes.map(j => metric(j.node.id, j.text.lines))],
    nodeExtraction: nodes.map(j => {const lines = lowCanonicalChinese(j.attempts.find(a => a.stage === 'writing').output, j.frame); return {node: j.node.id,
      canonicalAvailable: !!lines, sameExceptOuterQuotes: lines ? isDeepStrictEqual(normalize(lines), normalize(j.text.lines)) : null,
      differences: lines ? normalize(lines).flatMap((line, index) => isDeepStrictEqual(line, normalize(j.text.lines)[index]) ? [] : [{index, extracted: line, shown: normalize(j.text.lines)[index]}]) : [], warnings: j.writingWarnings};}),
  };
  const output = JSON.stringify(result, null, 2);
  assert(![...keys, ...endpoints].some(value => output.includes(value)), 'Private marker in evidence');
  await fs.writeFile(path.join(directory, 's4-blocked-verification.json'), output, {mode: 0o600});
  console.log(output);
} catch (error) {
  console.error(String(error?.message ?? 'S4 offline check failed').split('\n')[0]); process.exitCode = 1;
} finally {await vite.close();}

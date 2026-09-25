// Zero-network regression using retained real S4 input/output, not player storage.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {IDBFactory} from 'fake-indexeddb';
import {createServer} from 'vite';

assert.equal(process.argv.length, 3, 'Use <isolated CL-F report directory>');
const directory = path.resolve(process.argv[2]);
assert(path.dirname(directory) === path.resolve('dist/reports') && path.basename(directory).startsWith('airp-cl-f-'));
const vite = await createServer({configFile: false, server: {middlewareMode: true, hmr: false, ws: false, watch: null}, appType: 'custom'});
try {
  const load = name => vite.ssrLoadModule(`/src/${name}.ts`);
  const {parseTestConfig} = await load('game-infrastructure/airp-direct/test-config');
  const config = parseTestConfig(await fs.readFile('config/airp-test.local.json', 'utf8'));
  const keys = Object.values(config.keys).filter(Boolean), endpoints = [...new Set(Object.values(config.models).map(m => m.baseUrl))].sort((a, b) => b.length - a.length);
  let archive = await fs.readFile(path.join(directory, 'formal-save.json'), 'utf8');
  assert(!keys.some(key => archive.includes(key)));
  endpoints.forEach((url, index) => {archive = archive.replaceAll(`[configured-endpoint:${index}]`, url);});
  const {readD5Archive, validateD5Record} = await load('game-application/versions/d5-validate');
  const {serializeD5Archive} = await load('game-application/versions/d5-archive');
  const {SHOP_AIRP_CATALOG} = await load('game-runtime/shop-wave-context');
  const {D5_RUN_READERS} = await load('game-core/session/index');
  const {DATA_LIMITS} = await load('game-core/contracts/validation');
  const {poolSaveJson, unpoolSaveJson} = await load('game-core/contracts/pooled-json');
  const r = readD5Archive(JSON.stringify(JSON.parse(archive)), SHOP_AIRP_CATALOG, D5_RUN_READERS);
  assert.deepEqual(unpoolSaveJson(poolSaveJson(r)), r);
  assert.deepEqual(readD5Archive(serializeD5Archive(r), SHOP_AIRP_CATALOG, D5_RUN_READERS), r);
  const pending = r.airpGame.settlement.jobs.at(-1);
  assert(['ready', 'applied'].includes(pending.status), 'Expected a saved legal settlement');
  const appliedDuringCheck = pending.status === 'ready', added = Number(appliedDuringCheck);
  const {IndexedDbGameStore} = await load('game-infrastructure/storage/indexeddb');
  const {MemoryGameStore, MemoryGameDatabase} = await load('game-infrastructure/storage/memory');
  const {createPlayerRuntime} = await load('game-runtime/player-runtime');
  const factory = new IDBFactory(), disk = new IndexedDbGameStore('s4-pool-isolated', factory);
  let serial = 0;
  const runtime = createPlayerRuntime(disk, {newId: () => `pool:${++serial}`, newSeed: () => 19, close: () => disk.close()});
  assert((await runtime.application.restoreSave({archive: serializeD5Archive(r), clientRequestId: 'pool-restore'})).ok);
  const flow = runtime.airpGame.forSave(r.head.saveId, 24);
  await flow.settlement.apply(pending.id);
  const after = await disk.read(r.head.saveId);
  assert.equal(after.head.revision, r.head.revision + added);
  assert.equal(after.airpGame.settlement.jobs.at(-1).status, 'applied');
  assert.deepEqual(after.airpGame.settlement.jobs.at(-1).frames, pending.frames);
  assert.deepEqual(after.airpGame.settlement.jobs.at(-1).attempts, pending.attempts);
  assert.deepEqual(after.airpDirector, r.airpDirector);
  assert.deepEqual(after.facts.slice(0, r.facts.length), r.facts);
  assert.equal(after.airpGame.settlement.receipts.length, r.airpGame.settlement.receipts.length + added);
  assert.equal(after.airpGame.settlement.memories.length, r.airpGame.settlement.memories.length + added);
  validateD5Record(after, SHOP_AIRP_CATALOG, D5_RUN_READERS);
  await flow.settlement.apply(pending.id); assert.deepEqual(await disk.read(r.head.saveId), after);
  const output = await runtime.application.exportSave(r.head.saveId); assert(output.ok);
  assert.deepEqual(readD5Archive(output.archive, SHOP_AIRP_CATALOG, D5_RUN_READERS), after);
  const memory = new MemoryGameDatabase(); memory.records.set(r.head.saveId, r);
  const other = createPlayerRuntime(new MemoryGameStore(memory), {newId: () => `pool:${++serial}`, newSeed: () => 19, close() {}});
  await other.airpGame.forSave(r.head.saveId, 24).settlement.apply(pending.id);
  assert.deepEqual(memory.records.get(r.head.saveId), after, 'IndexedDB and memory runtime diverged');
  const exportedDb = new MemoryGameDatabase(), restored = createPlayerRuntime(new MemoryGameStore(exportedDb), {newId: () => `pool:${++serial}`, newSeed: () => 19, close() {}});
  assert((await restored.application.restoreSave({archive: output.archive, clientRequestId: 'pool-restore-again'})).ok);
  assert.deepEqual(exportedDb.records.get(r.head.saveId), after);
  const result = {status: 'passed', networkCalls: 0, appliedDuringCheck, originalRevision: r.head.revision, appliedRevision: after.head.revision,
    expandedBytesBefore: Buffer.byteLength(JSON.stringify(r)), pooledArchiveBytesBefore: Buffer.byteLength(serializeD5Archive(r)),
    expandedBytesAfter: Buffer.byteLength(JSON.stringify(after)), pooledArchiveBytesAfter: Buffer.byteLength(output.archive), physicalLimitBytes: DATA_LIMITS.bytes,
    exactRoundtrip: true, fullSourcesAndAttemptsUnchanged: true, originalFactsUnchanged: true, idempotentApply: true,
    indexedDbAndMemoryEqual: true, archiveRestoreEqual: true, affinity: after.airpGame.settlement.state.affinity,
    appliedSettlements: after.airpGame.settlement.receipts.length, memories: after.airpGame.settlement.memories.length};
  const safe = JSON.stringify(result, null, 2);
  assert(![...keys, ...endpoints].some(value => safe.includes(value)));
  await fs.writeFile(path.join(directory, appliedDuringCheck ? 'save-pooling-verification.json' : 'save-pooling-current.json'), safe, {mode: 0o600});
  console.log(safe); disk.close();
} finally { await vite.close(); }

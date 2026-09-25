// Opt-in two-call regression against a frozen real scene. Does not alter the source save.
// <source-report-dir> <scene-role> <expected-cumulative-calls>
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createServer } from 'vite';

assert((process.argv.length === 5 || process.argv.length === 6 && ['--context-version=6', '--context-version=7'].includes(process.argv[5])) && /^\d+$/.test(process.argv[4]), 'Use <CL-F report-dir> <role> <expected-cumulative-calls> [--context-version=6|7]');
const contextVersion = process.argv[5] ? Number(process.argv[5].split('=')[1]) : 4, readerVersion = contextVersion >= 7 ? 3 : 2;
const root = process.cwd(), sourceDir = path.resolve(process.argv[2]), role = process.argv[3], expected = Number(process.argv[4]);
assert(path.dirname(sourceDir) === path.join(root, 'dist/reports') && path.basename(sourceDir).startsWith('airp-cl-f-'));
const ledgerPath = path.join(root, 'dist/reports/airp-live/call-ledger.json');
const vite = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false, ws: false, watch: null }, appType: 'custom' });
let lockFile, directory, write, meta;
try {
  const load = name => vite.ssrLoadModule(`/src/${name}.ts`);
  const { parseTestConfig } = await load('game-infrastructure/airp-direct/test-config');
  const config = parseTestConfig(await fs.readFile('config/airp-test.local.json', 'utf8'));
  const keys = Object.values(config.keys).filter(Boolean), endpoints = [...new Set(Object.values(config.models).map(m => m.baseUrl))].sort((a, b) => b.length - a.length);
  const sanitize = value => {
    let text = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
    assert(!keys.some(key => text.includes(key)), 'Credential detected; refuse report write');
    endpoints.forEach((url, i) => { text = text.replaceAll(url, `[configured-endpoint:${i}]`); }); return text;
  };
  const ledger = JSON.parse(await fs.readFile(ledgerPath, 'utf8'));
  assert(ledger.calls === expected && expected + 2 <= ledger.limit, 'Budget changed or fewer than two calls remain');
  lockFile = await fs.open(`${ledgerPath}.cl-f.lock`, 'wx', 0o600);
  let archive = await fs.readFile(path.join(sourceDir, 'formal-save.json'), 'utf8');
  endpoints.forEach((url, i) => { archive = archive.replaceAll(`[configured-endpoint:${i}]`, url); });
  const version = JSON.parse(archive).record.contentRef.contentVersion;
  const catalog = version === 24 ? (await load('game-runtime/shop-wave-context')).SHOP_AIRP_CATALOG : (await load('game-runtime/airp-game-context')).AIRP_GAME_CATALOG;
  const { readD5Archive } = await load('game-application/versions/d5-validate');
  const { D5_RUN_READERS } = await load('game-core/session/index');
  const r = readD5Archive(archive, catalog, D5_RUN_READERS);
  const old = r.airpDirector.jobs.findLast(j => j.scene?.role === role && j.lowFrame && j.text);
  assert(old?.scene.progress, 'Need a frozen, read v3 scene with actual program progress');
  const { directorLowFrame } = await load('game-application/airp-director/low');
  const { compileLowRequest, readLowWriting, acceptLowText } = await load('game-application/airp-low/output');
  const { createLowProvider } = await load('game-infrastructure/airp-direct/low-provider');
  const scene = structuredClone(old.scene);
  let recoveredReadCount = 0;
  if (contextVersion >= 6) {
    // Replay only sources already committed when this real scene was frozen.
    // Do not borrow its later output, settlement or future events as its own history.
    const before = r.facts.filter(f => !r.retractedFactIds.includes(f.id) && f.source.revision <= scene.head.revision);
    const terminalFact = before.find(f => f.id === scene.progress.delivery?.returnFactId);
    if (terminalFact) {
      assert(terminalFact.kind === 'progression' && terminalFact.payload.type === 'expedition-settled');
      assert.equal(terminalFact.payload.terminal.runId, scene.progress.runResult?.runId);
      scene.progress.runResult.partyIds = [...terminalFact.payload.terminal.partyIds];
    }
    const { relatedDirectorRead } = await load('game-application/airp-director/settlement-context');
    const shares = before.filter(f => f.kind === 'airp-game' && f.payload.settlement).map(f => f.payload.settlement);
    scene.settlementRead = relatedDirectorRead(shares.map(s => ({ eventId: s.memory.scope.eventId, runId: s.memory.scope.runId, lines: s.read })), scene.eventId, scene.progress.runResult?.runId ?? null);
    recoveredReadCount = scene.settlementRead.length - (old.scene.settlementRead?.length ?? 0);
    assert(scene.settlementRead.every(l => l.sceneId !== old.id), 'Target output leaked into its own input');
  }
  const frame = directorLowFrame(r.airpGame.material, scene, contextVersion);
  assert.deepEqual(frame.sources, old.lowFrame.sources, 'Source activation changed; inspect before spending calls');
  assert.deepEqual(frame.trace, old.lowFrame.trace, 'Literary preset modules changed');
  assert.deepEqual(frame.sampling, old.lowFrame.sampling, 'Native sampling changed');
  assert(frame.messages.at(-1).content.endsWith(frame.scene.currentTurn));
  directory = await fs.mkdtemp(path.join(root, 'dist/reports/airp-continuity-'));
  await fs.chmod(directory, 0o700);
  write = (name, data) => fs.writeFile(path.join(directory, name), sanitize(data), { mode: 0o600 });
  meta = { sourceDir, role, contextVersion, recoveredReadCount, contentVersion: version, sourceJob: old.id, sourceHash: old.lowFrame.requestHash, targetHash: frame.requestHash, initialCalls: expected, calls: 0, status: 'running', attempts: [] };
  await write('frame.json', frame); await write('run.json', meta);
  const provider = createLowProvider(async (...args) => {
    const live = JSON.parse(await fs.readFile(ledgerPath, 'utf8'));
    assert(live.calls === expected + meta.calls && live.calls < live.limit && meta.calls < 2, 'Shared budget changed/exhausted');
    await fs.writeFile(ledgerPath, JSON.stringify({ ...live, calls: live.calls + 1 }));
    meta.calls++; await write('run.json', meta);
    console.log(JSON.stringify({ event: 'continuity-call', directory, role, cumulative: live.calls + 1 }));
    return fetch(...args);
  });
  let writing;
  for (const stage of ['writing', 'formatting']) {
    const request = compileLowRequest(frame, writing, readerVersion), slot = stage === 'writing' ? 'writing' : 'updater';
    const attempt = { stage, startedAt: Date.now(), status: 'running', requestHash: request.requestHash };
    meta.attempts.push(attempt); await write('run.json', meta);
    try {
      const response = await provider(request, config.models[slot], config.keys[slot], new AbortController().signal);
      Object.assign(attempt, { endedAt: Date.now(), usage: response.usage });
      await write(`${stage}-raw.txt`, response.text);
      if (stage === 'writing') { writing = response.text; attempt.warnings = readLowWriting(writing, frame, readerVersion).warnings; }
      else {
        const text = acceptLowText(response.text, writing, frame, readerVersion);
        await write('text.json', text);
        await write('text-cn.md', `# ${role} · 当前请求v${contextVersion}定点复验\n\n${text.lines.map(l => `${l.speaker}[${l.emotion}]：${l.text}`).join('\n\n')}\n\n${text.choices.map((c, i) => `${i + 1}. ${c}`).join('\n')}\n`);
      }
      attempt.status = 'succeeded'; await write('run.json', meta);
    } catch (error) {
      Object.assign(attempt, { status: 'failed', endedAt: Date.now(), code: error?.code ?? 'validation-error', usage: attempt.usage ?? error?.usage ?? null });
      throw error;
    }
  }
  meta.status = 'generated-awaiting-content-review'; await write('run.json', meta);
  console.log(JSON.stringify({ event: 'continuity-ready', directory, cumulative: expected + meta.calls, playerSaveChanged: false }));
} catch (error) {
  if (write && meta) { meta.status = 'failed'; await write('run.json', meta); }
  console.error(JSON.stringify({ event: 'continuity-stopped', directory, code: error?.code ?? 'check-failed' })); process.exitCode = 1;
} finally {
  if (lockFile) { await lockFile.close(); await fs.unlink(`${ledgerPath}.cl-f.lock`); }
  await vite.close();
}

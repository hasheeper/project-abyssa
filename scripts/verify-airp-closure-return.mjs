// Two-call, isolated return-scene comparison. Never rewrites the original game archive.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createServer } from 'vite';

const [source, expectedText] = process.argv.slice(2), expected = Number(expectedText), root = process.cwd();
assert(source && /^\d+$/.test(expectedText), 'Use <completed-source-report> <expected-calls>');
const sourceDir = path.resolve(source), ledgerPath = path.join(root, 'dist/reports/airp-live/call-ledger.json');
assert(path.dirname(sourceDir) === path.join(root, 'dist/reports') && path.basename(sourceDir).startsWith('airp-cl-f-'));
const vite = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false, watch: null }, appType: 'custom' });
let lock, calls = 0;
try {
  const load = name => vite.ssrLoadModule(`/src/${name}.ts`);
  const { parseTestConfig } = await load('game-infrastructure/airp-direct/test-config');
  const config = parseTestConfig(await fs.readFile('config/airp-test.local.json', 'utf8'));
  const ledger = JSON.parse(await fs.readFile(ledgerPath, 'utf8')); assert(ledger.calls === expected && expected + 2 <= ledger.limit);
  lock = await fs.open(`${ledgerPath}.cl-f.lock`, 'wx', 0o600);
  const r = JSON.parse(await fs.readFile(path.join(sourceDir, 'formal-save.json'), 'utf8')).record;
  const old = r.airpDirector.jobs.find(j => j.scene?.role === 'result');
  assert(old?.scene?.progress.delivery.status === 'confirmed');
  const { directorLowFrame } = await load('game-application/airp-director/low');
  const { compileLowRequest, acceptLowText } = await load('game-application/airp-low/output');
  const { createLowProvider } = await load('game-infrastructure/airp-direct/low-provider');
  const frame = directorLowFrame(r.airpDirector.lowMaterial, old.scene, 10, 5);
  assert.equal(JSON.parse(frame.scene.scenario).activeAuthorScript, null);
  assert.deepEqual(frame.sources, old.lowFrame.sources); assert.deepEqual(frame.sampling, old.lowFrame.sampling);
  const directory = await fs.mkdtemp(path.join(root, 'dist/reports/airp-closure-return-')); await fs.chmod(directory, 0o700);
  const secrets = Object.values(config.keys).filter(Boolean), endpoints = Object.values(config.models).map(m => m.baseUrl);
  const save = async (name, data) => {
    let value = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
    assert(!secrets.some(s => value.includes(s)), 'Credential detected; report withheld');
    for (const endpoint of endpoints) value = value.replaceAll(endpoint, '[configured-endpoint]');
    await fs.writeFile(path.join(directory, name), value, { mode: 0o600 });
  };
  const provider = createLowProvider(async (...args) => {
    const latest = JSON.parse(await fs.readFile(ledgerPath, 'utf8'));
    assert(latest.calls === expected + calls && calls < 2 && latest.calls < latest.limit);
    calls++; await fs.writeFile(ledgerPath, JSON.stringify({...latest, calls: latest.calls + 1}));
    return fetch(...args);
  });
  await save('frame.json', frame);
  const results = {};
  for (const stage of ['writing', 'formatting']) {
    const request = compileLowRequest(frame, stage === 'formatting' ? results.writing.text : undefined, 5);
    await save(`${stage}-request.json`, request);
    const slot = stage === 'writing' ? 'writing' : 'updater';
    console.log(JSON.stringify({ stage, directory, model: config.models[slot].model, cumulativeNext: expected + calls + 1 }));
    results[stage] = await provider(request, config.models[slot], config.keys[slot], new AbortController().signal);
    await save(`${stage}-response.json`, results[stage]);
  }
  const text = acceptLowText(results.formatting.text, results.writing.text, frame, 5);
  await save('visible-cn.md', `# 同行者交付收尾 · context10\n\n${text.lines.map(l => `${l.speaker}[${l.emotion}]：${l.text}`).join('\n\n')}\n\n${text.choices.map((c, i) => `${i + 1}. ${c}`).join('\n')}\n`);
  await save('result.json', { sourceReport: path.basename(sourceDir), originalFrameHash: old.lowFrame.requestHash, classification: 'isolated-return-comparison/not-written-to-game-save', calls, cumulative: expected + calls, usage: Object.fromEntries(Object.entries(results).map(([k, r]) => [k, r.usage])), text });
  console.log(JSON.stringify({ directory, calls, cumulative: expected + calls, lines: text.lines.length, choices: text.choices }));
} catch (error) { console.error(error?.name ?? 'Closure return verification failed'); process.exitCode = 1; }
finally { if (lock) { await lock.close(); await fs.unlink(`${ledgerPath}.cl-f.lock`); } await vite.close(); }

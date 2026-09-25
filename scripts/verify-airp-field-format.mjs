// Explicit, one-call formatter regression. Uses no player save or literary source in the API input.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createServer } from 'vite';

assert(process.argv.length === 3 && /^\d+$/.test(process.argv[2]), 'Pass the expected cumulative game-call count.');
const expected = Number(process.argv[2]), root = process.cwd();
const ledgerPath = path.join(root, 'dist/reports/airp-live/call-ledger.json');
const lockPath = `${ledgerPath}.cl-f.lock`;
const vite = await createServer({configFile: false, server: {middlewareMode: true, hmr: false, ws: false, watch: null}, appType: 'custom'});
let lock, directory, safe = () => '[private details withheld]';
try {
  const load = name => vite.ssrLoadModule(`/src/${name}.ts`);
  const {parseTestConfig} = await load('game-infrastructure/airp-direct/test-config');
  const config = parseTestConfig(await fs.readFile('config/airp-test.local.json', 'utf8'));
  const privateValues = [...Object.values(config.keys), ...Object.values(config.models).map(m => m.baseUrl)].filter(Boolean).sort((a, b) => b.length - a.length);
  safe = value => privateValues.reduce((s, v) => s.replaceAll(v, '[redacted]'), typeof value === 'string' ? value : JSON.stringify(value, null, 2));
  lock = await fs.open(lockPath, 'wx', 0o600);
  const ledger = JSON.parse(await fs.readFile(ledgerPath, 'utf8'));
  assert(ledger.calls === expected && ledger.calls < ledger.limit, 'Budget changed or exhausted.');
  const [{compileLowFrame}, {compileLowRequest, acceptLowText}, {lowR8Source}, {createLowProvider}] = await Promise.all([
    load('game-application/airp-low/native'), load('game-application/airp-low/output'), load('content/presentation/airp/low-r8-source'), load('game-infrastructure/airp-direct/low-provider'),
  ]);
  const draft = '旁白[平静]：门闩卡住了。\n\n艾洛拉[窘迫]：「我才没有窘迫！」\n\n艾洛拉[wink]：「先别拉门。」\n\n柯萝萝[wink]：「那就换个方向呀。」\n\n【可选回应】\n1. 认真倾听\n2. 轻松打趣\n3. 有所保留';
  const frame = compileLowFrame(lowR8Source, {id: 'field-format-live', actors: {elora: '艾洛拉', kororo: '柯萝萝'}, player: {id: 'kael', name: '凯尔'},
    scenario: '门前交谈', userInput: '玩家认真倾听', dialogue: {turn: 1, role: 'offer', purpose: '回应玩家', selectedResponse: '认真倾听', programState: {}, taskGuide: []}}, true, 6);
  const request = compileLowRequest(frame, draft, 6, 2);
  directory = await fs.mkdtemp(path.join(root, 'dist/reports/airp-field-format-'));
  const save = (name, value) => fs.writeFile(path.join(directory, name), safe(value), {mode: 0o600});
  await save('request.json', {model: config.models.updater.model, messages: request.messages});
  let calls = 0;
  const provider = createLowProvider(async (...args) => {
    assert(calls === 0, 'This check permits exactly one API call.');
    const current = JSON.parse(await fs.readFile(ledgerPath, 'utf8'));
    assert(current.calls === expected && current.calls < current.limit, 'Budget changed or exhausted.');
    await fs.writeFile(ledgerPath, JSON.stringify({...current, calls: current.calls + 1})); calls++;
    return fetch(...args);
  });
  const raw = await provider(request, config.models.updater, config.keys.updater, new AbortController().signal);
  await save('response.json', raw);
  const result = acceptLowText(raw.text, draft, frame, 6, 2);
  await save('accepted.json', result);
  const lines = [['门闩卡住了。', 'narrator', 'neutral'], ['我才没有窘迫！', 'elora', 'flustered'], ['先别拉门。', 'elora', 'neutral'], ['那就换个方向呀。', 'kororo', 'wink']];
  for (const [text, speaker, emotion] of lines) assert(result.lines.some(l => l.text.includes(text) && l.speaker === speaker && l.emotion === emotion), `Missing preserved line or correct field: ${text}`);
  const report = {passed: true, calls, cumulative: expected + calls, model: config.models.updater.model, usage: raw.usage,
    fieldRepairsNeeded: result.formatWarnings ?? [], lines: result.lines, phase: result.phase, playerSaveTouched: false};
  await save('report.json', report);
  console.log(safe({...report, directory: path.relative(root, directory)}));
} catch (error) {
  if (directory) await fs.writeFile(path.join(directory, 'error.json'), safe({error: error instanceof Error ? error.message : String(error), passed: false}), {mode: 0o600});
  console.error(safe({passed: false, error: error instanceof Error ? error.message : String(error), directory})); process.exitCode = 1;
} finally {
  if (lock) {await lock.close(); await fs.unlink(lockPath);}
  await vite.close();
}

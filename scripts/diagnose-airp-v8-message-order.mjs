// One explicit diagnostic: same frozen Gemini request, only the final task message role changes.
// Not a formal scene acceptance; no game-save access. Usage: <report-directory> <expected-calls>
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {readFileSync, writeFileSync} from 'node:fs';
import path from 'node:path';
import {createServer} from 'vite';
import {privateMarkers, pagesInventory, scanPrivateMarkers} from './lib/airp-pages.mjs';

assert(process.argv.length === 4 && /^\d+$/.test(process.argv[3]));
const root = process.cwd(), priorDirectory = path.resolve(process.argv[2]), expected = Number(process.argv[3]);
assert(priorDirectory.startsWith(path.join(root, 'dist/reports/airp-outline-v8-live-')));
const vite = await createServer({configFile: false, server: {middlewareMode: true}, appType: 'custom'});
let sanitize = () => '[details withheld]', directory;
try {
  const {parseTestConfig} = await vite.ssrLoadModule('/src/game-runtime/airp-generation.ts');
  const {createDirectProvider} = await vite.ssrLoadModule('/src/game-infrastructure/airp-direct/provider.ts');
  const {validateCreativeStage} = await vite.ssrLoadModule('/src/game-application/airp-generation/creative-output.ts');
  const privateText = await fs.readFile(path.join(root, 'config/airp-test.local.json'), 'utf8'), config = parseTestConfig(privateText), markers = privateMarkers(JSON.parse(privateText));
  sanitize = value => {
    let text = typeof value === 'string' ? value : JSON.stringify(value, (k, v) => k === 'baseUrl' ? '[configured-endpoint]' : v, 2);
    assert(!markers.keys.some(k => text.includes(k)), 'Credential found; refusing output');
    for (const e of [...markers.endpoints].sort((a, b) => b.length - a.length)) text = text.replaceAll(e, '[configured-endpoint]');
    return text;
  };
  const previous = JSON.parse(await fs.readFile(path.join(priorDirectory, 'writing-1.json'), 'utf8'));
  const planning = await fs.readFile(path.join(priorDirectory, 'planning-1-raw.txt'), 'utf8');
  const messages = structuredClone(previous.input.messages);
  assert.equal(messages.at(-1).role, 'system'); messages.at(-1).role = 'user';
  const model = {...previous.config, baseUrl: config.models.writing.baseUrl};
  const ledgerPath = path.join(root, 'dist/reports/airp-live/call-ledger.json');
  let ledger = JSON.parse(await fs.readFile(ledgerPath, 'utf8')); assert.equal(ledger.calls, expected); assert(ledger.calls < ledger.limit);
  directory = await fs.mkdtemp(path.join(root, 'dist/reports/airp-v8-order-diagnostic-')); await fs.chmod(directory, 0o700);
  const save = (name, value) => fs.writeFile(path.join(directory, name), sanitize(value), {mode: 0o600});
  await save('input.json', {mode: 'diagnostic-only', priorDirectory, changed: 'last message role system -> user only', config: model, messages});
  const result = {mode: 'diagnostic-only', priorDirectory, startedAt: Date.now()};
  const provider = createDirectProvider(async (url, init) => {
    assert.deepEqual(JSON.parse(readFileSync(ledgerPath, 'utf8')), ledger, 'Concurrent ledger change');
    assert.equal(ledger.calls, expected); ledger.calls++; writeFileSync(ledgerPath, JSON.stringify(ledger));
    console.log(sanitize({event: 'dispatch', directory, calls: ledger.calls, model: model.model}));
    const response = await fetch(url, init), raw = await response.clone().json().catch(() => null);
    await save('receipt.json', {status: response.status, model: raw?.model, usage: raw?.usage, choices: raw?.choices?.map(c => ({finish_reason: c.finish_reason, message: {content: c.message?.content}}))});
    if (typeof raw?.choices?.[0]?.message?.content === 'string') await save('raw.txt', raw.choices[0].message.content);
    return response;
  });
  try {
    const completed = await provider({config: model, messages}, config.keys.writing, new AbortController().signal);
    Object.assign(result, completed);
    try {validateCreativeStage('writing', completed.text, planning, {elora: '艾洛拉'}, 8); result.status = 'protocol-passed';}
    catch (e) {result.status = 'protocol-failed'; result.error = e.message;}
  } catch (e) {result.status = 'request-failed'; result.error = e.code ?? 'withheld';}
  result.endedAt = Date.now(); result.calls = ledger.calls;
  await save('result.json', result); await scanPrivateMarkers(directory, await pagesInventory(directory), markers);
  console.log(sanitize({directory, status: result.status, error: result.error, usage: result.usage, calls: ledger.calls}));
} catch (e) {console.error(sanitize({directory, error: e.code ?? 'diagnostic-stopped'})); process.exitCode = 1;}
finally {await vite.close();}

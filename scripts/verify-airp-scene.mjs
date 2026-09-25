// Explicit paid verification: one scene using the actual static UI and its provider.
// No short probes, automatic network retries, tracing, HAR or credential screenshots.
// Usage: node scripts/verify-airp-scene.mjs <verified-planning-model-id> <expected-calls> [cleared|extracted]
// Optional ABYSSA_AIRP_PRESET imports the user's original preset through the real UI.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { chromium } from 'playwright';

const [expectedModel, expectedText, outcome = 'cleared'] = process.argv.slice(2);
const expected = Number(expectedText);
assert(expectedModel && expectedText && Number.isSafeInteger(expected) && ['cleared', 'extracted'].includes(outcome));
const presetPath = process.env.ABYSSA_AIRP_PRESET;
if (presetPath) assert.equal(createHash('sha256').update(await fs.readFile(presetPath)).digest('hex'), '3d394088a2b4c19a6d819a9cfba7bfacb372296a626c1192eaa6cab62c383968', 'Unexpected original preset');
const root = process.cwd(), configPath = path.join(root, 'config/airp-test.local.json');
const reportRoot = path.join(root, 'dist/reports/airp-live'), ledgerPath = path.join(reportRoot, 'call-ledger.json');
const ledger = JSON.parse(await fs.readFile(ledgerPath, 'utf8'));
assert(ledger.calls === expected && Number.isSafeInteger(ledger.limit) && ledger.limit - expected >= 3, 'Budget changed or too small for a scene');
const config = JSON.parse(await fs.readFile(configPath, 'utf8'));
const connections = ['planning', 'writing', 'updater'].map(slot => ({ slot, ...config.connection, ...config.models[slot] }));
assert(connections.every(c => c.baseUrl && c.apiKey && c.model));
assert(connections[0].model === expectedModel, 'Selected planning model changed');
const endpointOrigins = connections.map(c => new URL(c.baseUrl).origin);
const secrets = connections.map(c => c.apiKey.trim());
const sanitize = value => {
  let json = JSON.stringify(value, (key, v) => key === 'baseUrl' ? '[configured-endpoint]' : v, 2);
  assert(!secrets.some(s => json.includes(s)), 'Credential detected; refusing to save evidence');
  for (const value of [...connections.map(c => c.baseUrl), ...endpointOrigins]) json = json.replaceAll(value, '[configured-endpoint]');
  return json;
};
const folder = path.join(reportRoot, `scene-${new Date().toISOString().replace(/[:.]/g, '-')}`);
await fs.mkdir(folder, { recursive: true });
const frozen = JSON.parse(await fs.readFile(path.join(reportRoot, '2026-09-22T14-51-48-836Z/stopped.json'), 'utf8')).run;
let spent = expected, posted = 0, operation = 'open';
const network = [], browser = await chromium.launch({ headless: true });
let page;
const readState = () => page.evaluate(() => ({ run: JSON.parse(sessionStorage.getItem('abyssa-airp-preview-v2') ?? 'null'), budget: JSON.parse(sessionStorage.getItem('abyssa-airp-call-budget-v1') ?? 'null') }));
const summary = state => ({ status: state.run?.status, calls: spent, sceneParagraphs: state.run?.scene?.lines.length ?? 0, attempts: state.run?.attempts.map(a => ({ stage: a.stage, status: a.status, model: a.config.model, inputBytes: a.input.bytes, outputCharacters: a.output?.length ?? 0, usage: a.usage, elapsedMs: a.endedAt === null ? null : a.endedAt - a.startedAt, error: a.error })) });
const save = async (label, state) => {
  assert(state.budget?.limit === ledger.limit && state.budget.calls >= expected);
  spent = Math.max(spent, state.budget.calls);
  writeFileSync(ledgerPath, JSON.stringify({ ...ledger, calls: spent }));
  await fs.writeFile(path.join(folder, `${label}.json`), sanitize({ label, origin: 'http://127.0.0.1:5195', ...state, network }));
  console.log(sanitize({ event: label, ...summary(state) }));
};
try {
  const context = await browser.newContext({ viewport: { width: 1600, height: 1000 }, reducedMotion: 'reduce' });
  await context.addInitScript(budget => { if (!sessionStorage.getItem('abyssa-airp-call-budget-v1')) sessionStorage.setItem('abyssa-airp-call-budget-v1', JSON.stringify(budget)); }, { calls: expected, limit: ledger.limit });
  page = await context.newPage();
  page.on('request', request => {
    if (request.method() !== 'POST' || !endpointOrigins.includes(new URL(request.url()).origin)) return;
    spent = Math.max(spent, expected + ++posted);
    writeFileSync(ledgerPath, JSON.stringify({ ...ledger, calls: spent }));
  });
  page.on('response', response => {
    if (!endpointOrigins.includes(new URL(response.url()).origin)) return;
    const request = response.request();
    const model = request.method() === 'POST' ? request.postDataJSON()?.model : null;
    network.push({ method: request.method(), status: response.status(), model, allowedOrigin: response.headers()['access-control-allow-origin'] ?? null });
    console.log(sanitize({ event: 'api-response', method: request.method(), status: response.status(), model }));
  });
  await page.goto('http://127.0.0.1:5195/airp.html');
  await page.getByLabel('导入测试配置', { exact: true }).setInputFiles(configPath);
  assert.equal(await page.getByLabel('创作模型 ID', { exact: true }).inputValue(), expectedModel);
  operation = 'catalog';
  const catalog = await page.evaluate(async c => {
    const url = new URL(c.baseUrl); url.pathname = url.pathname.replace(/\/+$/, '').replace(/\/chat\/completions$/, '') + '/models';
    try {
      const response = await fetch(url, { headers: { Authorization: `Bearer ${c.apiKey.trim()}` }, mode: 'cors', credentials: 'omit', redirect: 'error', cache: 'no-store' });
      if (!response.ok) return { status: response.status, ids: [] };
      const body = await response.json(); return { status: response.status, ids: (body.data ?? []).map(m => m.id) };
    } catch { return { status: 'browser-network-error', ids: [] }; }
  }, connections[0]);
  const matches = connections.map(c => ({ slot: c.slot, model: c.model, listed: catalog.ids.includes(c.model) }));
  await fs.writeFile(path.join(folder, 'catalog.json'), sanitize({ status: catalog.status, count: catalog.ids.length, matches }));
  assert(catalog.status === 200 && matches.every(m => m.listed), 'Model catalogue verification failed');
  await page.getByLabel('样例情境').selectOption(`medicine-case.${outcome}`);
  if (presetPath) await page.getByLabel('导入酒馆预设', { exact: true }).setInputFiles(presetPath);
  operation = 'generate';
  await page.getByRole('button', { name: '生成一场对白', exact: true }).click();
  let state, signature = '', change = 0;
  const started = Date.now();
  while (Date.now() - started < 800000) {
    state = await readState();
    const next = JSON.stringify([state.run?.status, state.run?.attempts.map(a => [a.stage, a.status])]);
    if (state.run && next !== signature) { signature = next; await save(`progress-${++change}`, state); }
    if (state.run && ['ready', 'failed', 'interrupted'].includes(state.run.status)) break;
    await delay(1500);
  }
  assert(state?.run && state.run.status !== 'running', 'Generation observation timed out');
  await save('completed', state);
  assert.equal(state.run.spec.sample.outcome, outcome);
  if (presetPath) assert(state.run.spec.preset.notes.some(n => n.includes('识别 Kemini_Dramatron_v3.1.json')), 'Original import not recognized');
  const sourceChecks = [];
  for (const source of state.run.spec.resources.sources) {
    assert.equal(createHash('sha256').update(source.text).digest('hex'), source.sha256);
    assert.equal(await fs.readFile(path.join(root, source.path), 'utf8'), source.text);
    sourceChecks.push({ path: source.path, sha256: source.sha256, bytes: Buffer.byteLength(source.text) });
    for (const a of state.run.attempts.filter(a => a.stage !== 'formatting')) {
      const required = state.run.spec.resources.version !== 5 || a.stage === 'planning' || source.kind !== 'world';
      assert.equal(a.input.messages.some(m => m.content.includes(source.text)), required, 'Full author source does not match the stage scope');
    }
  }
  for (const a of state.run.attempts.filter(a => a.stage === 'formatting')) assert(state.run.spec.resources.sources.every(source => !a.input.messages.some(m => m.content.includes(source.text))), 'Formatter received author library');
  await fs.writeFile(path.join(folder, 'source-integrity.json'), sanitize({ sourceChecks, fullSourcesPreserved: true, resourceVersion: state.run.spec.resources.version, outcome, originalPresetImported: Boolean(presetPath), planningMessagesMatchFableBaseline: JSON.stringify(state.run.attempts[0]?.input.messages) === JSON.stringify(frozen.attempts[0].input.messages) }));
  assert.equal(state.run.status, 'ready', 'Scene not ready; inspect bounded stage evidence');
  if (state.run.spec.resources.version === 5) assert(state.run.scene.lines.every(line => !/[\u3040-\u30ff]/u.test(line.text)), 'Final scene still contains Japanese kana');
  for (const a of state.run.attempts) if (a.output) await fs.writeFile(path.join(folder, `${a.stage}-${a.ordinal}.txt`), JSON.parse(sanitize(a.output)));
  operation = 'read';
  await page.getByRole('button', { name: '阅读生成对白', exact: true }).click();
  const firstDialogue = state.run.scene.lines.findIndex(line => line.speaker === 'elora');
  for (let cursor = 0; cursor < state.run.scene.lines.length; cursor++) {
    await page.locator('.rp-app[data-state=idle]').waitFor({ timeout: 60000 });
    if (cursor === 0) await page.screenshot({ path: path.join(folder, 'avg.png') });
    if (cursor === 1) await page.screenshot({ path: path.join(folder, 'avg-next.png') });
    if (cursor === firstDialogue) await page.screenshot({ path: path.join(folder, 'avg-dialogue.png') });
    await page.getByRole('button', { name: cursor === state.run.scene.lines.length - 1 ? '结束试读' : '下一句', exact: true }).click();
  }
  const before = await readState();
  assert.equal(before.run.cursor, state.run.scene.lines.length - 1);
  assert.equal(JSON.stringify(before.run), JSON.stringify({ ...state.run, cursor: before.run.cursor }), 'Reading changed more than preview cursor');
  assert.equal(before.budget.calls, state.budget.calls, 'Reading made an unexpected API call');
  await page.reload();
  const after = await readState();
  const refresh = { fullyRead: true, readingChangedOnlyCursor: true, restored: after.run?.status === 'ready', cursorRetained: before.run.cursor === after.run.cursor, callsUnchanged: before.budget.calls === after.budget.calls, keyCleared: await page.getByLabel('公共 API Key', { exact: true }).inputValue() === '' };
  await fs.writeFile(path.join(folder, 'refresh.json'), sanitize(refresh));
  assert(Object.values(refresh).every(Boolean), 'Refresh verification failed');
  console.log(sanitize({ event: 'verified', ...summary(after), refresh }));
} catch (error) {
  if (page) await save('stopped', await readState()).catch(() => {});
  let reason = String(error?.message ?? 'failed').split('\n')[0];
  for (const value of [...secrets, ...connections.map(c => c.baseUrl), ...endpointOrigins]) reason = reason.replaceAll(value, '[redacted]');
  console.log(JSON.stringify({ event: 'stopped', operation, reason }));
  process.exitCode = 1;
} finally {
  await fs.writeFile(path.join(folder, 'network.json'), sanitize(network));
  await browser.close();
  console.log(JSON.stringify({ evidenceFolder: folder }));
}

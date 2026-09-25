import { openManorJournal } from "./playable-helpers";
import { test, expect, type Page } from "@playwright/test";
import { fork, type ChildProcess } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { projectRoot } from "../../config/paths.mjs";
import type { PoolRecord } from "../../src/game-application/testing/airp-pool-playthrough";
import { observeArtifacts } from "./helpers";

const rpRoot = process.env.ABYSSA_RP_ROOT;
test.skip(!rpRoot, "Native AIRP browser tests require ABYSSA_RP_ROOT and its matching SQLite Node runtime");
test.describe.configure({ mode: "serial" });
let child: ChildProcess, host: { baseUrl: string; releaseId: string }, gate: PoolRecord;
let sequence = 0, diagnostics = "";
const pending = new Map<number, { resolve(value: any): void; reject(error: Error): void }>();
function rpc(type: string, fields: object = {}): Promise<any> {
  return new Promise((resolve, reject) => {
    const id = ++sequence;
    const timer = setTimeout(() => { pending.delete(id); reject(Error(`AIRP test host timed out: ${diagnostics}`)); }, 30000);
    pending.set(id, { resolve: value => { clearTimeout(timer); resolve(value); }, reject: error => { clearTimeout(timer); reject(error); } });
    child.send({ id, type, ...fields });
  });
}
test.beforeEach(async () => {
  test.setTimeout(240000);
  gate = JSON.parse(readFileSync(resolve(projectRoot, 'dist/reports/airp-4/checkpoints.json'), 'utf8')).gate;
  diagnostics = "";
  child = fork(resolve(projectRoot, 'scripts/airp-test-host.mjs'), [rpRoot!], {
    cwd: resolve(rpRoot!, 'server'), execPath: process.env.ABYSSA_RP_NODE ?? '/opt/homebrew/bin/node',
    execArgv: ['--import', 'tsx'], stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
  });
  child.stdout!.on('data', data => { diagnostics += data; }); child.stderr!.on('data', data => { diagnostics += data; });
  host = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(Error(`AIRP native host did not start: ${diagnostics}`)), 60000);
    child.on('message', (message: any) => {
      if (message.type === 'ready') { clearTimeout(timer); resolve(message); return; }
      const request = pending.get(message.id); pending.delete(message.id);
      if (message.ok) request?.resolve(message.result); else request?.reject(Error(message.error));
    });
    child.once('exit', code => { clearTimeout(timer); reject(Error(`AIRP host exited ${code}: ${diagnostics}`)); for (const request of pending.values()) request.reject(Error('Host exited')); pending.clear(); });
  });
});
test.afterEach(async () => {
  if (!child || child.exitCode !== null) return;
  const stopped = new Promise<void>(resolve => child.once('exit', () => resolve()));
  if (child.connected) child.send({ type: 'stop' }); else child.kill('SIGTERM');
  const timer = setTimeout(() => child.kill('SIGTERM'), 5000);
  await stopped; clearTimeout(timer);
});
async function saved(page: Page): Promise<PoolRecord> {
  return page.evaluate(async () => {
    const saveId = new URLSearchParams(location.hash.split('?')[1]).get('save')!;
    return new Promise<any>((resolve, reject) => {
      const open = indexedDB.open('abyssa-game-v1', 1); open.onerror = () => reject(open.error);
      open.onsuccess = () => { const db = open.result, get = db.transaction('saves', 'readonly').objectStore('saves').get(saveId); get.onsuccess = () => { resolve(get.result); db.close(); }; get.onerror = () => { reject(get.error); db.close(); }; };
    });
  });
}
async function ready(page: Page) {
  await expect.poll(() => page.evaluate(() => document.querySelector('.game-client-status')?.getAttribute('data-status') === 'ready'), { timeout: 60000 }).toBe(true);
}
async function openGate(page: Page) {
  await page.goto('/'); await page.getByRole('button', { name: '记录', exact: true }).click({ timeout: 60000 });
  await page.getByRole('button', { name: '档案管理', exact: true }).click();
  await page.getByRole('button', { name: '导入档案', exact: true }).click();
  await page.getByLabel('导入格式').selectOption('restore');
  await page.getByLabel('导入存档', { exact: true }).setInputFiles({ name: 'airp-online.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ archiveVersion: 4, record: gate })) });
  await expect(page).toHaveURL(/#\/menu/, { timeout: 60000 });
  await page.goto(`/#/mansion?save=${gate.head.saveId}&epoch=${gate.head.epoch}`); await ready(page);
  await expect(page.getByRole('region', { name: '选择叙事来源' })).toBeVisible();
  await expect(page.locator('.rp-app')).toHaveCount(0);
}
async function connect(page: Page) {
  await page.getByLabel('rp 应用接口', { exact: true }).fill(host.baseUrl);
  await page.getByLabel('AIRP Release ID', { exact: true }).fill(host.releaseId);
  await page.getByRole('button', { name: '绑定独立游玩实例', exact: true }).click();
  await expect(page.getByText('已连接 AIRP 应用', { exact: true })).toBeVisible({ timeout: 60000 });
  await expect(page.getByRole('button', { name: '联网生成', exact: true })).toBeEnabled();
}
const entry = (record: PoolRecord) => record.airpOnline!.entries.at(-1)!;
async function readConversation(page: Page) {
  for (let i = 0; i < 40; i++) {
    await ready(page); const record = await saved(page), reading = record.narrative.reading;
    if (!reading || reading.completed) return;
    await expect(page.locator('.rp-app')).toHaveAttribute('data-state', 'idle');
    await page.locator('.rp-app__cue').click();
    await expect.poll(async () => (await saved(page)).head.revision, { timeout: 30000 }).toBeGreaterThan(record.head.revision);
  }
  throw Error('Reading did not terminate');
}
const text = (followup = false) => ({ creationRecord: '已知药箱归还。只回应共同经历，不替玩家发言。', lines: [
  { speaker: 'elora', emotion: followup ? 'confident' : 'wry', text: followup ? '搭扣我已经扣好了，还是刚才那只药箱。' : '搭扣还在。下次别拿它试石头的硬度。' },
  { speaker: 'elora', emotion: 'smile', text: '放这里吧，我把桌面腾出来了。' },
] });
async function queueWriting(body: ReturnType<typeof text> | string) {
  const invalid = typeof body === 'string';
  await rpc('scripts', { scripts: [
    { chunks: ['检查搭扣，再回应；仅使用共同记忆。'] },
    { chunks: [invalid ? '正文' : body.lines.map(line => line.text).join('\n')] },
    { chunks: [invalid ? body : JSON.stringify(body)] },
    ...(invalid ? [{ chunks: [body] }] : []),
  ] });
}
async function queueMemory(record: PoolRecord) {
  await rpc('scripts', { scripts: [{ chunks: [JSON.stringify({ version: 'state-patch-model-output-v1', operations: [{ op: 'set', path: `/memories/${entry(record).ticket!.request.requestId}/summary`, value: '艾洛拉已经检查归还的药箱搭扣。' }] })] }] });
}

test('AIRP-4: native browser flow survives a lost response and two windows, then recalls confirmed memory', async ({ page, context }, info) => {
  test.setTimeout(240000); page.setDefaultTimeout(60000);
  const errors = await observeArtifacts(page);
  // Override the offline-suite guard only for this exact temporary native test host.
  await page.route(`${host.baseUrl}/**`, route => route.continue());
  await openGate(page); await connect(page); await queueWriting(text());
  // The real backend commits, but the client loses its response. Refresh must replay the same request.
  await page.route('**/api/v1/conversation-threads/*/interactions', async route => { await route.fetch(); await route.abort('failed'); }, { times: 1 });
  await page.getByRole('button', { name: '联网生成', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('AIRP 操作未完成');
  expect(entry(await saved(page)).source).toBe('requested');
  expect((await rpc('inspect')).calls).toHaveLength(3);
  const other = await context.newPage();
  await Promise.all([page.reload(), other.goto(page.url())]);
  await expect.poll(async () => entry(await saved(page)).source, { timeout: 60000 }).toBe('generated');
  await ready(page); await expect(page.locator('.rp-app')).toHaveAttribute('data-state', 'idle');
  expect((await rpc('inspect')).calls).toHaveLength(3);
  expect((await rpc('inspect')).sessionCount).toBe(2); // one development fixture, one player
  let record = await saved(page); const frozen = record.narrative.scenes.find(s => s.id === entry(record).sceneId)!.body;
  await page.screenshot({ path: info.outputPath('native-wry-dialogue.png') });
  await page.getByText('AIRP · 连接与记录', { exact: true }).click();
  await page.getByText('前置创作记录', { exact: true }).click();
  await expect(page.locator('.airp-creation-record')).toContainText(text().creationRecord);
  const panel = await page.locator('.airp-story-tools__panel').boundingBox();
  expect(panel!.y).toBeGreaterThanOrEqual(0); expect(panel!.y + panel!.height).toBeLessThanOrEqual(900);
  expect(await page.locator('.airp-story-tools__panel').evaluate(element => {
    const rect = element.getBoundingClientRect();
    return element.contains(document.elementFromPoint(rect.x + 25, rect.y + 25));
  })).toBe(true); // Above the dialogue frame, not just within the viewport.
  await page.screenshot({ path: info.outputPath('native-connection-record.png') });
  await page.getByText('AIRP · 连接与记录', { exact: true }).click();
  await queueMemory(record); await readConversation(page);
  await expect.poll(async () => !!entry(await saved(page)).controlReceipt, { timeout: 60000 }).toBe(true);
  record = await saved(page);
  expect((await rpc('inspect', { receipt: entry(record).controlReceipt })).state.memories).toHaveLength(1);
  const funds = record.snapshot.campaign.funds;
  await page.getByRole('button', { name: '确认交付', exact: true }).click(); await ready(page);
  await other.close();
  await openManorJournal(page, "旧药箱的搭扣"); await page.getByRole('button', { name: '再和艾洛拉聊聊药箱', exact: true }).click(); await ready(page);
  await queueWriting(text(true)); await page.getByRole('button', { name: '联网生成', exact: true }).click();
  await expect.poll(async () => entry(await saved(page)).source, { timeout: 60000 }).toBe('generated');
  record = await saved(page); await queueMemory(record);
  expect(JSON.stringify((await rpc('inspect')).calls[4])).toContain('已经检查归还的药箱搭扣');
  await expect(page.locator('.rp-app')).toHaveAttribute('data-state', 'idle');
  await page.screenshot({ path: info.outputPath('native-confident-followup.png') });
  await page.reload(); await ready(page);
  expect((await saved(page)).narrative.scenes.find(s => s.id === gate.airpOnline!.entries[0].sceneId)!.body).toEqual(frozen);
  await readConversation(page);
  await expect.poll(async () => !!entry(await saved(page)).controlReceipt, { timeout: 60000 }).toBe(true);
  record = await saved(page);
  expect(record.snapshot.campaign.funds).toEqual(funds);
  const inspected = await rpc('inspect', { receipt: entry(record).controlReceipt });
  expect(inspected.state.memories).toHaveLength(2); expect(inspected.calls).toHaveLength(8);
  // The deliberately aborted request is a network console error, not an uncaught UI error.
  expect(errors.filter(error => !error.includes('net::ERR_FAILED'))).toEqual([]);
});

test('AIRP-4: malformed native text can be explicitly abandoned without replacing authored text', async ({ page }, info) => {
  test.setTimeout(180000); page.setDefaultTimeout(60000);
  await openGate(page); await connect(page); await queueWriting('not JSON');
  await page.getByRole('button', { name: '联网生成', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('AIRP 操作未完成');
  await expect(page.locator('.rp-app')).toHaveCount(0);
  await page.getByRole('button', { name: '停止等待，使用手写稿', exact: true }).click();
  await expect.poll(async () => !!entry(await saved(page)).controlReceipt, { timeout: 60000 }).toBe(true);
  const record = await saved(page), current = entry(record);
  expect(current.source).toBe('handwritten'); expect(current.accepted).toBeNull();
  const native = await rpc('inspect', { receipt: current.controlReceipt });
  expect(native.calls).toHaveLength(4); expect(native.state.pending).toBe(''); expect(native.state.memories).toHaveLength(0);
  await expect(page.locator('.rp-app')).toHaveAttribute('data-state', 'idle');
  await page.screenshot({ path: info.outputPath('explicit-handwritten-fallback.png') });
  await page.reload(); await ready(page); expect((await saved(page)).narrative).toEqual(record.narrative);
});

test('AIRP-4: required Updater rejection preserves reading and blocks dependent generation without automatic model retries', async ({ page }, info) => {
  test.setTimeout(180000); page.setDefaultTimeout(60000);
  await openGate(page); await connect(page); await queueWriting(text());
  await rpc('scripts', { scripts: [{ chunks: [JSON.stringify({ version: 'state-patch-model-output-v1', operations: [] })] }] });
  await page.getByRole('button', { name: '联网生成', exact: true }).click();
  await expect.poll(async () => entry(await saved(page)).source, { timeout: 60000 }).toBe('generated');
  await readConversation(page);
  await expect(page.getByRole('alert')).toContainText('airp-incomplete');
  const before = await saved(page);
  expect(before.narrative.reading!.completed).toBe(true); expect(entry(before).controlReceipt).toBeNull();
  expect((await rpc('inspect')).calls).toHaveLength(4);
  await page.getByRole('button', { name: '重试同一请求', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('airp-incomplete');
  expect((await rpc('inspect')).calls).toHaveLength(4); expect(await saved(page)).toEqual(before);
  await page.screenshot({ path: info.outputPath('required-updater-failed.png') });
  await page.getByRole('button', { name: '确认交付', exact: true }).click(); await ready(page);
  await expect(page.getByRole('button', { name: '再和艾洛拉聊聊药箱', exact: true })).toHaveCount(0);
  expect((await saved(page)).snapshot.campaign.funds).toEqual(before.snapshot.campaign.funds);
});

test('AIRP-4: two windows recover a lost Session creation response without creating a second player Session', async ({ page, context }) => {
  test.setTimeout(180000); page.setDefaultTimeout(60000);
  await openGate(page);
  await page.route('**/api/v1/sessions', async route => {
    if (route.request().method() !== 'POST') return route.continue();
    await route.fetch(); await route.abort('failed');
  });
  await page.getByLabel('rp 应用接口', { exact: true }).fill(host.baseUrl);
  await page.getByLabel('AIRP Release ID', { exact: true }).fill(host.releaseId);
  await page.getByRole('button', { name: '绑定独立游玩实例', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('AIRP 操作未完成');
  expect((await saved(page)).airpOnline!.connection!.binding).toBeNull();
  expect((await rpc('inspect')).sessionCount).toBe(2);
  await page.unroute('**/api/v1/sessions');
  const other = await context.newPage();
  await Promise.all([page.reload(), other.goto(page.url())]);
  await expect.poll(async () => !!(await saved(page)).airpOnline!.connection!.binding, { timeout: 60000 }).toBe(true);
  await ready(page); await ready(other);
  expect((await saved(other)).airpOnline!.connection!.binding).toEqual((await saved(page)).airpOnline!.connection!.binding);
  expect((await rpc('inspect')).sessionCount).toBe(2); expect((await rpc('inspect')).calls).toHaveLength(0);
  await other.close();
});

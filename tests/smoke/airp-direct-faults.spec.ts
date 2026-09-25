import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { directReturnGate } from '../../src/game-application/testing/airp-direct-patrol';
import type { D5GameRecord } from '../../src/game-application';
import { directReady, readDirectConversation, savedDirect } from './airp-direct-helpers';
import { openManorJournal } from './playable-helpers';
import { writingEnvelope } from '../../src/game-application/testing/airp-writing-fixture';

let fixture: D5GameRecord;
test.beforeAll(async () => {fixture = await (await directReturnGate('extracted')).read();});
async function openFixture(page: Page) {
  page.setDefaultTimeout(60000);
  await page.goto('/'); await page.getByRole('button', {name: '记录', exact: true}).click();
  await page.getByRole('button', {name: '档案管理', exact: true}).click();
  await page.getByRole('button', {name: '导入档案', exact: true}).click();
  await page.getByLabel('导入格式').selectOption('restore');
  await page.getByLabel('导入存档', {exact: true}).setInputFiles({name: 'p2-fault-fixture.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({archiveVersion: 4, record: fixture}))});
  await expect(page).toHaveURL(/#\/(menu|mansion)/);
  await page.goto(`/#/mansion?save=${fixture.head.saveId}&epoch=${fixture.head.epoch}`);
  await directReady(page);
}
async function configure(page: Page) {
  await page.getByText('API／模型／预设设置', {exact: true}).click();
  await page.getByLabel('公共 API 地址', {exact: true}).fill('https://example.invalid/v1');
  await page.getByLabel('公共 API Key', {exact: true}).fill('mock-only-credential');
  for (const label of ['大纲', '正文', '格式化']) await page.getByLabel(`${label}模型 ID`, {exact: true}).fill(`test-${label}`);
  await page.getByText('API／模型／预设设置', {exact: true}).click();
}
async function provider(context: BrowserContext, badFormat = false) {
  let calls = 0, release: (() => void) | null = null;
  await context.route('https://example.invalid/v1/chat/completions', async route => {
    const body = route.request().postDataJSON(); calls++;
    if (calls === 1) await new Promise<void>(resolve => {release = resolve;});
    const output = body.model === 'test-大纲' ? '模拟三段规划。' : body.model === 'test-正文' ? writingEnvelope('艾洛拉等候回应。') : badFormat ? '{}' : JSON.stringify({creationRecord: '保留原文', lines: [{speaker: 'narrator', emotion: 'neutral', text: '艾洛拉等候回应。'}]});
    await route.fulfill({status: 200, contentType: 'application/json', body: JSON.stringify({choices: [{message: {content: output}, finish_reason: 'stop'}]})}).catch(() => {});
  });
  return {count: () => calls, release: () => release!()};
}
test('P2 mock fault: two real browser tabs share one paid-stage lock; refresh never sends a request', async ({page, context}) => {
  const p = await provider(context); await openFixture(page); await configure(page);
  const other = await context.newPage(); await other.goto(page.url()); await directReady(other); await configure(other);
  await page.getByRole('button', {name: '生成这场对白', exact: true}).click();
  await expect.poll(p.count).toBe(1);
  await other.getByRole('button', {name: /^(生成这场对白|继续原任务)$/}).click();
  expect(p.count()).toBe(1); p.release();
  await expect.poll(async () => (await savedDirect(page)).airpDirect!.tasks[0].source, {timeout: 120000}).toBe('browser-direct');
  await directReady(page); await directReady(other);
  expect(p.count()).toBe(3);
  await Promise.all([page.reload(), other.reload()]); await directReady(page); await directReady(other);
  expect(p.count()).toBe(3);
  expect((await savedDirect(page)).airpDirect!.tasks[0].attempts).toHaveLength(3);
});
test('P2 mock fault: in-flight refresh requires explicit retry and preserves unknown outcome', async ({page, context}) => {
  const p = await provider(context); await openFixture(page); await configure(page);
  await page.getByRole('button', {name: '生成这场对白', exact: true}).click(); await expect.poll(p.count).toBe(1);
  await page.reload(); await directReady(page); p.release();
  expect(p.count()).toBe(1);
  await expect(page.getByText('上次执行结果待确认', {exact: true})).toBeVisible();
  await configure(page); await page.getByRole('button', {name: '继续原任务', exact: true}).click();
  await expect.poll(async () => (await savedDirect(page)).airpDirect!.tasks[0].source, {timeout: 120000}).toBe('browser-direct');
  const attempts = (await savedDirect(page)).airpDirect!.tasks[0].attempts;
  expect(p.count()).toBe(4); expect(attempts[0]).toMatchObject({status: 'interrupted', outcomeUnknown: true, output: null});
});
test('P2 mock fault: real IndexedDB quota failure retains output and retries only the local commit', async ({page, context}, info) => {
  const p = await provider(context); await openFixture(page); await configure(page);
  // Deliberate test-only fault at the receipt write, after the candidate save write is queued.
  await page.evaluate(() => {
    const original = IDBObjectStore.prototype.put; let armed = true;
    IDBObjectStore.prototype.put = function (value: any, key?: IDBValidKey) {
      if (armed && this.name === 'receipts' && value.airpDirect?.command.type === 'airp-direct-result') {armed = false; throw new DOMException('test-quota', 'QuotaExceededError');}
      return original.call(this, value, key!);
    };
  });
  await page.getByRole('button', {name: '生成这场对白', exact: true}).click(); await expect.poll(p.count).toBe(1); p.release();
  await expect(page.getByRole('button', {name: '仅重试保存输出', exact: true})).toBeEnabled({timeout: 60000});
  // Popup artwork must not trap input away from global save recovery.
  const recovery = page.getByRole('button', {name: '重新读取 / 重试', exact: true});
  await recovery.focus(); await expect(recovery).toBeFocused();
  await page.screenshot({path: info.outputPath('generation-save-failed.png')});
  expect((await savedDirect(page)).airpDirect!.tasks[0].attempts[0].status).toBe('running');
  await page.getByRole('button', {name: '仅重试保存输出', exact: true}).click(); await directReady(page);
  await expect.poll(async () => (await savedDirect(page)).airpDirect!.tasks[0].attempts[0].status).toBe('succeeded');
  expect(p.count()).toBe(1);
});
test('P2 mock fault: cancellation plus explicit handwriting refuses delayed generated output', async ({page, context}) => {
  const p = await provider(context); await openFixture(page); await configure(page);
  await page.getByRole('button', {name: '生成这场对白', exact: true}).click(); await expect.poll(p.count).toBe(1);
  await page.getByRole('button', {name: '取消请求', exact: true}).click();
  await expect(page.getByRole('button', {name: '使用手写稿', exact: true})).toBeEnabled();
  await page.getByRole('button', {name: '使用手写稿', exact: true}).click();
  await page.getByRole('button', {name: '确认使用手写稿', exact: true}).click(); p.release();
  await directReady(page); const task = (await savedDirect(page)).airpDirect!.tasks[0];
  expect(task.source).toBe('handwritten'); expect(task.attempts[0].output).toBeNull();
  expect((await savedDirect(page)).airpDirect!.memories).toEqual([]); expect(p.count()).toBe(1);
});
test('P2 mock fault: switch to title and delete the test archive before a delayed response', async ({page, context}) => {
  const p = await provider(context); await openFixture(page); await configure(page);
  await page.getByRole('button', {name: '生成这场对白', exact: true}).click(); await expect.poll(p.count).toBe(1);
  // Navigating away disposes the owning session. All deletion is through the real archive UI.
  await page.goto('/'); await page.getByRole('button', {name: '记录', exact: true}).click();
  await page.getByRole('button', {name: '选择档案 守望者之崖 · 林恩', exact: true}).hover();
  await page.getByRole('button', {name: '删除档案 林恩', exact: true}).click();
  await page.getByRole('button', {name: '删除档案', exact: true}).click(); p.release();
  await expect(page.getByText('尚未留下旅程记录', {exact: true})).toBeVisible();
  const remaining = await page.evaluate(async () => new Promise<any[]>(resolve => {
    const o = indexedDB.open('abyssa-game-v1'); o.onsuccess = () => {const db = o.result, r = db.transaction('saves').objectStore('saves').getAll(); r.onsuccess = () => {resolve(r.result); db.close();};};
  }));
  expect(remaining).toEqual([]); expect(p.count()).toBe(1);
});

test('G5: compact progress, honest timer, keyboard confirmation and both motion preferences', async ({page, context}, info) => {
  const p = await provider(context); await openFixture(page);
  await expect(page.getByRole('button', {name: '打开AI设置', exact: true})).toBeVisible();
  await page.getByRole('button', {name: '打开AI设置', exact: true}).click();
  await expect(page.locator('.airp-direct-details > summary').first()).toBeFocused();
  const longModel = 'mock-' + 'long-model-name-'.repeat(20);
  await page.getByLabel('大纲模型 ID', {exact: true}).fill(longModel);
  await expect(page.getByLabel('大纲模型 ID', {exact: true})).toHaveValue(longModel);
  expect(await page.locator('.airp-direct-progress').evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
  await page.screenshot({path: info.outputPath('generation-settings-expanded.png')});
  // The scrollport must stop inside the frame, even mid-field and at the end.
  const scrollport = page.locator('.airp-direct-gate__body');
  for (const viewport of [{width: 1600, height: 900}, {width: 1280, height: 720}]) {
    await page.setViewportSize(viewport);
    const bounds = await scrollport.evaluate(el => {
      const body = el.getBoundingClientRect(), frame = el.closest('.abyssa-frame')!.getBoundingClientRect();
      return {top: body.top - frame.top, bottom: frame.bottom - body.bottom, overflowX: el.scrollWidth > el.clientWidth, scrolls: el.scrollHeight > el.clientHeight};
    });
    expect(bounds.top).toBeGreaterThanOrEqual(20); expect(bounds.bottom).toBeGreaterThanOrEqual(20);
    expect(bounds.overflowX).toBe(false); expect(bounds.scrolls).toBe(true);
    await scrollport.evaluate(el => {el.scrollTop = el.scrollHeight;});
    await expect(page.locator('.airp-direct-diagnostics > summary')).toBeInViewport();
    await page.screenshot({path: info.outputPath(`generation-settings-bottom-${viewport.width}.png`)});
  }
  await page.setViewportSize({width: 1600, height: 900});
  await page.getByText('API／模型／预设设置', {exact: true}).click();
  expect(p.count()).toBe(0); await configure(page);
  await expect(page.locator('.airp-generation-scene__backdrop img')).toBeVisible();
  await expect.poll(() => page.locator('.airp-generation-scene__backdrop img').evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0)).toBe(true);
  await expect(page.locator('.airp-direct-gate .abyssa-rpg-header')).toHaveCount(0);
  await expect(page.getByRole('region', {name: '场景创作', exact: true})).toBeVisible();
  await expect(page.locator('.airp-direct-rail__index b')).toHaveText(['Ⅰ', 'Ⅱ', 'Ⅲ']);
  const box = await page.locator('.airp-direct-gate').boundingBox();
  expect(box!.width).toBeLessThanOrEqual(620); expect(box!.height).toBeLessThan(450);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('region', {name: '场景创作', exact: true})).toBeVisible();
  expect(p.count()).toBe(0);
  await expect(page.locator('.airp-direct-diagnostics')).not.toHaveAttribute('open');
  await page.locator('.airp-direct-gate__heading').click();
  await page.screenshot({path: info.outputPath('generation-ready-1600.png')});
  await page.setViewportSize({width: 1280, height: 720});
  await page.screenshot({path: info.outputPath('generation-ready-1280.png')});
  await page.emulateMedia({reducedMotion: 'no-preference'});
  await page.getByRole('button', {name: '生成这场对白', exact: true}).click(); await expect.poll(p.count).toBe(1);
  await expect(page.getByText('正在生成大纲', {exact: true})).toBeVisible();
  await expect(page.locator('.airp-direct-elapsed')).not.toContainText('00:00');
  expect(p.count()).toBe(1);
  const index = page.locator('.airp-direct-rail [aria-current="step"] .airp-direct-rail__index');
  await expect(index).toHaveCSS('animation-name', 'airp-direct-breathe');
  await page.screenshot({path: info.outputPath('generation-requesting.png')});
  await page.emulateMedia({reducedMotion: 'reduce'});
  await expect(index).toHaveCSS('animation-name', 'none');
  await page.getByRole('button', {name: '取消请求', exact: true}).click();
  const handwrite = page.getByRole('button', {name: '使用手写稿', exact: true});
  await expect(handwrite).toBeEnabled(); await handwrite.click();
  await expect(page.getByRole('dialog', {name: '本场改用手写稿？'})).toBeVisible();
  await expect(page.getByRole('button', {name: '取消', exact: true})).toBeFocused();
  await page.keyboard.press('Escape'); await expect(handwrite).toBeFocused();
  expect((await savedDirect(page)).airpDirect!.tasks[0].source).toBe('requested');
  await handwrite.click(); await page.getByRole('button', {name: '确认使用手写稿', exact: true}).click(); p.release();
  await expect.poll(async () => (await savedDirect(page)).airpDirect!.tasks[0].source).toBe('handwritten');
  expect(p.count()).toBe(1);
});

test('G5: waiting tab can stop without cancelling the owning tab', async ({page, context}) => {
  const p = await provider(context); await openFixture(page); await configure(page);
  const other = await context.newPage(); await other.goto(page.url()); await directReady(other); await configure(other);
  await page.getByRole('button', {name: '生成这场对白', exact: true}).click(); await expect.poll(p.count).toBe(1);
  await other.getByRole('button', {name: /^(生成这场对白|继续原任务)$/}).click();
  await expect(other.getByText('正在等待此存档的其他操作', {exact: true})).toBeVisible();
  await other.getByRole('button', {name: '停止等待', exact: true}).click();
  await expect(other.getByRole('button', {name: '停止等待', exact: true})).not.toBeVisible();
  await expect(page.getByText('正在生成大纲', {exact: true})).toBeVisible();
  expect(p.count()).toBe(1); p.release();
  await expect.poll(async () => (await savedDirect(page)).airpDirect!.tasks[0].source, {timeout: 120000}).toBe('browser-direct');
  expect(p.count()).toBe(3);
});

test('G5: exhausted formatter offers no unusable retry', async ({page, context}, info) => {
  const p = await provider(context, true); await openFixture(page); await configure(page);
  await page.getByRole('button', {name: '生成这场对白', exact: true}).click(); await expect.poll(p.count).toBe(1); p.release();
  await expect(page.getByText('本任务已达重试上限', {exact: true})).toBeVisible({timeout: 120000});
  expect(p.count()).toBe(4);
  await expect(page.getByRole('button', {name: '继续原任务', exact: true})).not.toBeVisible();
  await expect(page.getByRole('button', {name: '使用手写稿', exact: true})).toBeEnabled();
  await page.screenshot({path: info.outputPath('generation-exhausted.png')});
});

test('G5: unsupported lock reports an actionable reason without a paid call', async ({page, context}) => {
  const p = await provider(context);
  await page.addInitScript(() => Object.defineProperty(navigator, 'locks', {value: undefined}));
  await openFixture(page); await configure(page);
  await page.getByRole('button', {name: '生成这场对白', exact: true}).click();
  await expect(page.getByText('此环境暂不支持直连生成', {exact: true})).toBeVisible();
  expect(p.count()).toBe(0);
  await expect(page.getByRole('button', {name: '使用手写稿', exact: true})).toBeEnabled();
});

test('G5: memory failure stays visible outside details and retries only updater', async ({page, context}, info) => {
  const p = await provider(context); let updates = 0;
  await context.route('https://example.invalid/v1/chat/completions', async route => {
    const body = route.request().postDataJSON();
    if (!body.messages[0].content.includes('记录整理器')) {await route.fallback(); return;}
    updates++;
    if (updates === 1) {await route.fulfill({status: 429, contentType: 'application/json', body: '{}'}); return;}
    const input = JSON.parse(body.messages[1].content);
    const content = JSON.stringify({summary: '艾洛拉等候回应。', supports: [input.lines[0].id], flags: []});
    await route.fulfill({status: 200, contentType: 'application/json', body: JSON.stringify({choices: [{message: {content}, finish_reason: 'stop'}]})});
  });
  await openFixture(page); await configure(page);
  await page.getByRole('button', {name: '生成这场对白', exact: true}).click(); await expect.poll(p.count).toBe(1); p.release();
  await expect.poll(async () => (await savedDirect(page)).airpDirect!.tasks[0].source, {timeout: 120000}).toBe('browser-direct');
  await page.getByText('AIRP · 生成记录', {exact: true}).click();
  await expect(page.locator('.airp-story-tools__panel')).toBeVisible();
  expect(await page.locator('.airp-story-tools__panel .airp-direct-progress').evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
  const recordInset = await page.locator('.airp-direct-record__body').evaluate(el => el.closest('.abyssa-frame')!.getBoundingClientRect().bottom - el.getBoundingClientRect().bottom);
  expect(recordInset).toBeGreaterThanOrEqual(12);
  await page.screenshot({path: info.outputPath('reading-record-panel.png')});
  await page.getByText('AIRP · 生成记录', {exact: true}).click();
  await readDirectConversation(page);
  await page.getByRole('button', {name: '确认交付并整理记忆', exact: true}).click();
  await expect.poll(() => updates).toBe(1); await directReady(page);
  await openManorJournal(page, '旧药箱的搭扣');
  await expect(page.getByText('委托与阅读进度已保存。', {exact: true})).toBeVisible();
  await expect(page.locator('.airp-direct-memory').getByText('记忆整理未完成', {exact: true})).toBeVisible();
  await page.screenshot({path: info.outputPath('memory-recovery-journal.png')});
  const delivered = await savedDirect(page);
  expect(delivered.airpDirect!.tasks[0].read).not.toBeNull();
  expect(delivered.narrative?.version === 2 && delivered.narrative.instances.find(i => i.id === delivered.airpDirect!.tasks[0].instanceId)?.status).toBe('resolved');
  await page.getByRole('button', {name: '查看处理选项', exact: true}).click();
  await page.screenshot({path: info.outputPath('memory-recovery-expanded.png')});
  await page.getByRole('button', {name: '重新整理记忆', exact: true}).click();
  await expect.poll(async () => (await savedDirect(page)).airpDirect!.memories.length, {timeout: 60000}).toBe(1);
  expect(updates).toBe(2); expect(p.count()).toBe(3);
  expect((await savedDirect(page)).snapshot).toEqual(delivered.snapshot);
});

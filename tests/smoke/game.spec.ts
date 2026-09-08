import { test, expect } from '@playwright/test';
import { entries } from '../../config/entries.mjs';
import { expectMounted, observeArtifacts } from './helpers';
import { buildProbe, depart, finishFirstLayer, importSample, inspectPage, ready, startLegacy } from './playable-helpers';
test.beforeAll(buildProbe);
for (const prefix of ['/', '/abyssa/']) {
  for (const entry of entries.filter(entry => entry.kind === 'game')) {
    test(`${prefix}${entry.html} loads and reloads without AI`, async ({ page }) => {
      const failures = await observeArtifacts(page);
      await page.goto(`${prefix}${entry.html}`); await expectMounted(page);
      await page.reload(); await expectMounted(page);
      if (['menu','mansion','map','battle','shop'].includes(entry.id)) await expect(page.getByRole('link', { name: '选择档案' })).toBeVisible();
      expect(failures).toEqual([]);
    });
  }
  test(`${prefix} UI creates, fights, settles, returns and starts a second expedition`, async ({ page }, info) => {
    test.setTimeout(120_000);
    const failures = await observeArtifacts(page);
    await startLegacy(page, prefix);
    const save = new URLSearchParams(new URL(page.url()).hash.split('?')[1]).get('save');
    await depart(page, 5);
    const firstUrl = page.url();
    await finishFirstLayer(page);
    await expect(page.getByRole('dialog', { name: '继续深入？' })).toBeVisible();
    await page.getByRole('button', { name: '带宝离场', exact: true }).click();
    await expect(page.getByRole('dialog', { name: '远征结算' })).toBeVisible();
    const terminal = (await inspectPage(page)).record;
    expect(terminal.pendingSettlement).not.toBeNull();
    expect(terminal.snapshot.campaign.appliedSettlements).toHaveLength(0);
    await page.reload(); await ready(page);
    await page.getByRole('button', { name: '结算并返回洋馆' }).dblclick();
    await expect(page).toHaveURL(/#\/mansion\?/); await ready(page);
    const home = (await inspectPage(page)).record;
    expect(home.head.saveId).toBe(save);
    expect(home.snapshot.campaign.appliedSettlements).toHaveLength(1);
    expect(home.snapshot.campaign.funds.party).toBe(home.snapshot.campaign.appliedSettlements[0].result.totalGold);
    await expect(page.getByTestId('campaign-funds')).toContainText(`小队金币 ${home.snapshot.campaign.funds.party}`);
    await expect(page.getByText('已经回到洋馆了，先休息一下吧。')).toBeVisible();
    await page.screenshot({ path: info.outputPath('mansion-after-settlement.png') });
    await page.goto(firstUrl); await ready(page);
    await expect(page.getByText('远征已入账')).toBeVisible();
    expect((await inspectPage(page)).record.snapshot.campaign.appliedSettlements).toHaveLength(1);
    await depart(page, 3);
    const second = (await inspectPage(page)).record;
    expect(second.snapshot.expedition!.id).not.toBe(terminal.snapshot.expedition!.id);
    expect(second.head.saveId).toBe(save);
    expect(second.snapshot.expedition!.party.map(p => p.id)).toEqual(['kael','eustice','kororo']);
    await page.screenshot({ path: info.outputPath('three-member-battle.png') });
    await page.getByRole('link', { name: '返回菜单', exact: true }).click();
    await page.getByRole('button', { name: /商店/ }).click(); await page.getByRole('button', { name: /商店/ }).click();
    await expect(page).toHaveURL(/#\/shop\?/); await ready(page);
    await expect(page.getByTestId('shop-funds')).toContainText(`小队金币 ${home.snapshot.campaign.funds.party}`);
    await expect(page.getByRole('button', { name: '购买', exact: true })).toBeDisabled();
    await page.screenshot({ path: info.outputPath('shop.png') });
    await page.goBack(); await ready(page); await page.goForward(); await ready(page);
    expect(failures).toEqual([]);
  });
}
for (const kind of ['cursor', 'next-round', 'clear'] as const) test(`legacy ${kind} import resumes once and refresh preserves RNG and assets`, async ({ page }) => {
  await importSample(page, kind);
  const before = await inspectPage(page);
  expect(before.battle!.mode.type).toBe(kind === 'clear' ? 'greed' : 'awaiting-roll');
  await page.reload(); await ready(page);
  const after = await inspectPage(page);
  expect(after.record).toEqual(before.record);
});
for (const kind of ['final-hit', 'wipe'] as const) test(`${kind} interruption sample reaches terminal through UI and settles once`, async ({ page }, info) => {
  await importSample(page, kind);
  if (kind === 'final-hit') {
    await page.locator('.abyssa-expedition-party-card[data-character="kael"]').click();
    await page.locator('.abyssa-expedition-enemy[data-targetable="true"]').click();
  } else await page.getByRole('button', { name: 'END TURN' }).click();
  await expect(page.getByRole('dialog', { name: '远征结算' })).toBeVisible();
  const before = (await inspectPage(page)).record;
  const outcome = before.snapshot.expedition!.lifecycle;
  expect(outcome.type).toBe('finished');
  if (outcome.type === 'finished') expect(outcome.result.wiped).toBe(kind === 'wipe');
  await page.screenshot({ path: info.outputPath(`${kind}-terminal.png`) });
  await page.getByRole('button', { name: '结算并返回洋馆' }).click();
  await expect(page).toHaveURL(/#\/mansion\?/); await ready(page);
  const after = (await inspectPage(page)).record;
  expect(after.snapshot.campaign.appliedSettlements).toHaveLength(1);
  expect(after.snapshot.campaign.funds.party).toBe(after.snapshot.campaign.appliedSettlements[0].result.totalGold);
});
test('refresh during attack and enemy batch preserves the committed state', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await importSample(page, 'final-hit');
  await page.locator('.abyssa-expedition-party-card[data-character="kael"]').click();
  await page.locator('.abyssa-expedition-enemy[data-targetable="true"]').click();
  await expect(page.locator('.abyssa-expedition')).toHaveAttribute('data-attack-phase', 'anticipate');
  const committed = (await inspectPage(page)).record;
  await page.reload(); await ready(page);
  expect((await inspectPage(page)).record).toEqual(committed);
  await expect(page.getByRole('dialog', { name: '远征结算' })).toBeVisible();
  await importSample(page, 'next-round');
  await page.getByRole('button', { name: 'ROLL', exact: true }).click();
  await expect(page.getByRole('button', { name: 'END TURN' })).toBeEnabled();
  await page.getByRole('button', { name: 'END TURN' }).click();
  await expect(page.locator('.abyssa-expedition')).toHaveAttribute('data-enemy-turn-phase', 'anticipate');
  const batch = (await inspectPage(page)).record;
  await page.reload(); await ready(page);
  expect((await inspectPage(page)).record).toEqual(batch);
});
test('two stale tabs cannot apply the same player roll twice', async ({ page, context }) => {
  await page.addInitScript(() => { Object.defineProperty(window, 'BroadcastChannel', { value: undefined }); });
  await importSample(page, 'next-round'); const second = await context.newPage();
  await second.addInitScript(() => { Object.defineProperty(window, 'BroadcastChannel', { value: undefined }); });
  await second.goto(page.url()); await ready(second);
  const before = (await inspectPage(page)).record;
  await page.getByRole('button', { name: 'ROLL', exact: true }).click(); await ready(page);
  await second.getByRole('button', { name: 'ROLL', exact: true }).click();
  await expect(second.getByRole('alert')).toContainText('进度已在另一页面改变');
  expect((await inspectPage(second)).record.head.revision).toBe(before.head.revision + 1);
  await second.getByRole('button', { name: '重新读取 / 重试' }).click(); await ready(second);
  await expect(second.getByRole('button', { name: 'END TURN' })).toBeEnabled();
});
test('blocked storage does not fake a successful new game', async ({ page }) => {
  await page.addInitScript(() => { Object.defineProperty(window, 'indexedDB', { get() { throw new DOMException('Unavailable', 'SecurityError'); } }); });
  await page.goto('/title.html');
  await page.getByRole('button', { name: '新的开始', exact: true }).click();
  await expect(page).toHaveURL(/#\/title$/);
  await expect(page.getByRole('status')).toContainText('存档');
});

test('two-member formation, failed write and original-request retry use real IndexedDB', async ({ page }, info) => {
  await startLegacy(page); await depart(page, 2);
  await page.screenshot({ path: info.outputPath('two-member-battle.png') });
  const before = (await inspectPage(page)).record;
  await page.evaluate(() => {
    (window as any).savedPut = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function () { throw new DOMException('Full disk', 'QuotaExceededError'); };
  });
  await page.getByRole('button', { name: 'ROLL', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('存储空间不足');
  expect((await inspectPage(page)).record).toEqual(before);
  const request = await page.evaluate(() => Object.entries(sessionStorage).find(([key]) => key.startsWith('abyssa:pending:'))?.[1]);
  expect(request).toBeTruthy();
  await page.evaluate(() => { IDBObjectStore.prototype.put = (window as any).savedPut; });
  await page.getByRole('button', { name: '重新读取 / 重试' }).click(); await ready(page);
  expect((await inspectPage(page)).record.head.revision).toBe(before.head.revision + 1);
  expect(await page.evaluate(() => Object.keys(sessionStorage).filter(key => key.startsWith('abyssa:pending:')))).toEqual([]);
  await expect(page.getByRole('button', { name: 'END TURN' })).toBeEnabled();
});
test('archive lists corrupt slots separately and export/import creates a new identity', async ({ page }, info) => {
  await startLegacy(page); const original = (await inspectPage(page)).record;
  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => { const r = indexedDB.open('abyssa-game-v1', 1); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
    await new Promise<void>((resolve, reject) => { const tx = db.transaction('saves', 'readwrite'); tx.objectStore('saves').put({ broken: true }, 'corrupt'); tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); }); db.close();
  });
  await page.goto('/title.html');
  await expect(page).toHaveURL(/#\/title/);
  await expect(page.locator('html')).not.toHaveAttribute('data-scene-transition', /.+/);
  await page.screenshot({ path: info.outputPath('title.png') });
  await page.getByRole('button', { name: '记录', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '游戏档案' });
  await expect(dialog).toContainText('暂不可读取');
  await expect(dialog.getByRole('button', { name: /载入档案/ })).toHaveCount(1);
  await page.screenshot({ path: info.outputPath('archive.png') });
  const download = page.waitForEvent('download');
  await dialog.getByRole('button', { name: '导出存档', exact: true }).click();
  const downloaded = await download; const path = (await downloaded.path())!;
  await page.getByLabel('导入存档', { exact: true }).setInputFiles(path);
  await expect(page).toHaveURL(/#\/menu\?/); await ready(page);
  const imported = (await inspectPage(page)).record;
  expect(imported.head.saveId).not.toBe(original.head.saveId);
  expect(imported.head.epoch).not.toBe(original.head.epoch);
  expect(imported.snapshot.campaign).toEqual(original.snapshot.campaign);
  await page.goto('/title.html');
  await page.getByRole('button', { name: '记录', exact: true }).click();
  await expect(page.getByRole('button', { name: /载入档案/ })).toHaveCount(2);
});
test('dice remains an isolated local demo without a runtime service', async ({ page }) => {
  const failures = await observeArtifacts(page);
  await page.goto('/dice.html');
  await expect(page.locator('.dice-runtime-state')).toHaveText('LOCAL FALLBACK');
  await page.getByRole('button', { name: /过牌.*CHECK/ }).click();
  const call = page.getByRole('button', { name: /跟注.*CALL/ });
  await expect.poll(async () => (await page.locator('.dice-duel').getAttribute('data-phase')) === 'public-lock' || (await call.isVisible() && await call.isEnabled())).toBe(true);
  if (await call.isVisible()) await call.click();
  await expect(page.locator('.dice-duel')).toHaveAttribute('data-phase', 'public-lock');
  const confirm = page.getByRole('button', { name: '确认 · CONFIRM', exact: true });
  await expect(confirm).toBeEnabled({ timeout: 15_000 }); await confirm.click();
  await expect(page.locator('.dice-duel')).toHaveAttribute('data-phase', 'private-lock');
  expect(failures).toEqual([]);
});

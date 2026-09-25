import { expect, type Page } from '@playwright/test';
import type { D5GameRecord } from '../../src/game-application';
import { nextD5PlayCommand } from '../../src/game-application/testing/d5-playthrough';
import { AIRP_DIRECT_CATALOG } from '../../src/game-runtime/airp-direct-context';
import type { ValidatedD5Catalog } from '../../src/game-core/contracts';
import { confirmNewGame } from './new-game-helpers';
import { depart, openManorJournal, ready } from './playable-helpers';

/** Read-only probe. The production UI alone creates the save and issues game commands. */
export async function savedDirect(page: Page): Promise<D5GameRecord> {
  return page.evaluate(async () => {
    const id = new URLSearchParams(location.hash.split('?')[1]).get('save')!;
    return new Promise<any>((resolve, reject) => {
      const open = indexedDB.open('abyssa-game-v1');
      open.onerror = () => reject(open.error);
      open.onsuccess = () => {
        const db = open.result, get = db.transaction('saves', 'readonly').objectStore('saves').get(id);
        get.onsuccess = () => {resolve(get.result); db.close();};
        get.onerror = () => {reject(get.error); db.close();};
      };
    });
  });
}
export async function directReady(page: Page) {
  await ready(page);
  const board = page.locator('.abyssa-expedition');
  // A foreground ADV intentionally keeps the underlying expedition busy until
  // the player dismisses it. Wait for its own transition, not the paused board.
  await expect.poll(async () => !!await page.locator('.scene-sequence[data-scene="adv"]').count()
    || !await board.count() || await board.getAttribute('aria-busy') === 'false', {timeout: 30000}).toBe(true);
  const sequence = page.locator('.scene-sequence');
  if (await sequence.count()) await expect(sequence).toHaveAttribute('data-phase', 'idle', {timeout: 30000});
}
export async function readDirectConversation(page: Page, stopBeforeFinal = false) {
  for (let step = 0; step < 300; step++) {
    await directReady(page);
    const r = await savedDirect(page), n = r.narrative;
    if (n?.version !== 2 || !n.reading || n.reading.completed || n.reading.paused) return;
    const scene = n.scenes.find(s => s.id === n.reading!.sceneId)!, node = scene.body.nodes[n.reading.node];
    if (stopBeforeFinal && n.reading.node === scene.body.nodes.length - 1) return;
    await expect(page.locator('.rp-app')).toHaveAttribute('data-state', 'idle');
    if (node.kind === 'choice') await page.getByRole('button', {name: node.options[2].label, exact: true}).click();
    else await page.locator('.rp-app__cue').click();
    await expect.poll(async () => (await savedDirect(page)).head.revision).toBeGreaterThan(r.head.revision);
  }
  throw Error('Reading did not terminate');
}
export async function newDirectGame(page: Page) {
  await page.addInitScript(() => {
    const original = crypto.getRandomValues.bind(crypto);
    crypto.getRandomValues = values => {if (values instanceof Uint32Array && values.length === 1) {values[0] = 19; return values;} return original(values);};
  });
  await page.goto('/');
  await page.getByRole('button', {name: '新的开始', exact: true}).click();
  await confirmNewGame(page, '旧版 AIRP 调试', '林恩');
  await expect(page).toHaveURL(/#\/mansion\?/); await directReady(page);
  const r = await savedDirect(page);
  expect(r.contentRef.contentVersion).toBe(18);
  expect(r.snapshot.campaign.manor.takeover).toBeNull();
  expect(r.snapshot.campaign.settlements).toEqual([]);
  expect(r.airpDirect!.tasks).toEqual([]);
}
export async function directPatrol(page: Page, outcome: 'cleared' | 'extracted') {
  await openManorJournal(page, '旧药箱的搭扣');
  await page.getByRole('button', {name: '问问艾洛拉', exact: true}).click();
  await readDirectConversation(page);
  await playPatrolRoute(page, outcome);
  await openManorJournal(page, '旧药箱的搭扣');
  await page.getByRole('button', {name: '找艾洛拉收尾', exact: true}).click();
  await directReady(page);
  expect((await savedDirect(page)).airpDirect!.tasks[0].source).toBe('undecided');
}

/** Shared real route UI; no event acceptance, completion injection, or model response mocks. */
export async function playPatrolRoute(page: Page, outcome: 'cleared' | 'extracted', catalog: ValidatedD5Catalog = AIRP_DIRECT_CATALOG) {
  await depart(page, 5, 60000, true);
  for (let step = 0; step < 700; step++) {
    await directReady(page);
    if (await page.locator('.scene-sequence[data-scene="adv"]').count()) {await page.getByRole('button', {name: '跳过本段对白'}).click(); continue;}
    const r = await savedDirect(page);
    if (!r.snapshot.run) {
      // Cleared patrols can settle automatically before the end-panel's return
      // button is pressed; persisted completion is not route navigation.
      if (new URL(page.url()).hash.startsWith('#/battle?')) await page.getByRole('button', {name: '返回洋馆', exact: true}).click();
      break;
    }
    const op = nextD5PlayCommand(catalog, r);
    if (op.type === 'resume-run') {await expect.poll(async () => (await savedDirect(page)).head.revision).toBeGreaterThan(r.head.revision); continue;}
    if (op.type === 'settle-expedition') {await page.getByRole('button', {name: '返回洋馆', exact: true}).click(); break;}
    if (op.type === 'advance-room') await page.getByRole('button', {name: '继续前进', exact: true}).click();
    else if (op.type === 'choose-event') await page.getByRole('button', {name: op.choiceId === 'skip' ? '绕行' : '阅读迎宾簿', exact: true}).click();
    else if (op.type === 'choose-exit') await page.getByRole('button', {name: outcome === 'extracted' ? '带宝离场' : '深入宴会厅', exact: true}).click();
    else if (op.type === 'use-item' && op.target.kind === 'member') {
      if (r.snapshot.run.kind !== 'expedition') throw Error('No patrol');
      const index = r.snapshot.run.state.run.supplies.findIndex(s => s.instanceId === op.instanceId);
      await page.getByRole('button', {name: '打开道具坞', exact: true}).click();
      await page.locator('.item-dock__slots button').nth(index).click();
      const names: Record<string, string> = {kael: '林恩', elora: '艾洛拉', eustice: '尤斯缇丝', kororo: '柯萝萝', norma: '诺玛'};
      await page.locator('.item-dock__target-list').getByRole('button', {name: names[op.target.id], exact: true}).click();
      await directReady(page); await page.getByRole('button', {name: '返回行动', exact: true}).click();
    } else if (op.type === 'battle-command') {
      const c = op.command;
      if (c.type === 'roll' || c.type === 'end-turn' || c.type === 'reroll') await page.getByRole('button', {name: c.type === 'end-turn' ? 'END TURN' : c.type.toUpperCase(), exact: true}).click();
      else if (c.type === 'toggle-load') await page.locator(`[data-tutorial-anchor="battle.die:${c.actorId}"]`).click();
      else if (c.type === 'act') {
        await page.locator(`[data-tutorial-anchor="battle.member:${c.actorId}"]`).click();
        await page.locator(`[data-tutorial-anchor="battle.${c.choice === 'heal' ? 'member' : c.choice === 'guard' ? 'intent' : 'enemy'}:${c.targetId}"]`).click();
      } else throw Error(`Unsupported UI action ${c.type}`);
    } else throw Error(`Unsupported UI command ${op.type}`);
    await expect.poll(async () => (await savedDirect(page)).head.revision).toBeGreaterThan(r.head.revision);
  }
  await expect(page).toHaveURL(/#\/mansion/, {timeout: 60000}); await directReady(page);
  const r = await savedDirect(page);
  expect(r.snapshot.campaign.settlements.at(-1)?.outcome).toBe(outcome);
}

export async function manualDirectCopy(page: Page) {
  // Existing side offers must be resolved/declined at the ordinary safe-copy boundary.
  for (let count = 0; count < 12; count++) {
    const r = await savedDirect(page);
    const other = r.narrative?.version === 2 && r.narrative.instances.find(i => i.status === 'pending' || i.status === 'offered');
    if (!other) break;
    await openManorJournal(page, other.definition.id);
    await page.getByRole('button', {name: /^(问问.+|继续这段交谈)$/}).click(); await directReady(page);
    await page.getByRole('button', {name: '这次不接', exact: true}).click(); await readDirectConversation(page);
  }
  if (await page.getByRole('dialog', {name: '日志', exact: true}).isVisible()) await page.keyboard.press('Escape');
  const before = await savedDirect(page);
  await page.getByRole('button', {name: '展开菜单', exact: true}).click();
  await page.getByRole('button', {name: '存档', exact: true}).click();
  const empty = page.getByRole('button', {name: /槽位 \d+ · 空白存档/}).first();
  await expect(empty).toBeEnabled();
  const slot = (await empty.getAttribute('aria-label'))!.match(/槽位 (\d+)/)![1];
  await empty.click(); await page.getByRole('button', {name: '确认存档', exact: true}).click();
  await expect(page.getByText(`已保存至槽位 ${slot}`, {exact: true})).toBeVisible({timeout: 60000});
  await page.getByRole('button', {name: '返回游戏', exact: true}).click();
  await page.getByRole('button', {name: '读档', exact: true}).click();
  await page.getByRole('button', {name: new RegExp(`^槽位 ${slot} ·`)}).click();
  await page.getByRole('button', {name: '读取所选档案', exact: true}).click();
  await expect.poll(async () => new URLSearchParams(new URL(page.url()).hash.split('?')[1]).get('save'), {timeout: 60000}).not.toBe(before.head.saveId);
  await directReady(page);
  const copy = await savedDirect(page);
  expect(copy.head.epoch).not.toBe(before.head.epoch);
  expect(copy.airpDirect).toEqual(before.airpDirect);
  expect(copy.originRef?.source.head.saveId).toBe(before.head.saveId);
  return {before, copy};
}

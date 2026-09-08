import { expect, test, type Page } from '@playwright/test';
import { build } from 'esbuild';
import { resolve } from 'node:path';
import { PerspectiveCamera, Vector3 } from 'three';
import { projectRoot } from '../../config/paths.mjs';
import type { inspect } from '../../src/game-runtime/testing/playable-browser';
import { interruptionArchive, legacyCampaignArchive } from '../../src/game-runtime/testing/playable-fixtures';
export const probe = resolve(projectRoot, 'dist/reports/s3/browser/playable-probe.js');
export async function buildProbe() { await build({ absWorkingDir: projectRoot, entryPoints: ['src/game-runtime/testing/playable-browser.ts'], outfile: probe, bundle: true, format: 'iife', globalName: 'AbyssaPlayableTest', platform: 'browser', target: 'es2022' }); }
export async function inspectPage(page: Page): Promise<Awaited<ReturnType<typeof inspect>>> {
  if (!await page.evaluate(() => Boolean((window as any).AbyssaPlayableTest))) await page.addScriptTag({ path: probe });
  return page.evaluate(async () => (window as any).AbyssaPlayableTest.inspect(new URLSearchParams(location.hash.split("?")[1] ?? location.search).get('save')));
}
export async function ready(page: Page) {
  await expect(page.locator('.game-client-status')).toHaveAttribute('data-status', 'ready');
  await expect(page.locator('html')).not.toHaveAttribute('data-scene-transition', /.+/, { timeout: 15_000 });
}
export async function startLegacy(page: Page, prefix = '/') {
  // Test-only initial seed injection; production URLs and runtime remain unchanged.
  await page.addInitScript(() => {
    const native = crypto.getRandomValues.bind(crypto);
    crypto.getRandomValues = values => { if (values instanceof Uint32Array && values.length === 1) { values[0] = 19; return values; } return native(values); };
  });
  // Existing rift scenarios explicitly import their original rules through player UI.
  await page.goto(prefix); await page.getByRole('button', { name: '记录', exact: true }).click();
  await page.getByLabel('导入格式').selectOption('application');
  await page.getByLabel('导入存档', {exact: true}).setInputFiles({name: 'legacy-campaign.json', mimeType: 'application/json', buffer: Buffer.from(await legacyCampaignArchive())});
  await expect(page).toHaveURL(/#\/menu\?save=.+&epoch=.+/); await ready(page);
}
export async function openSortie(page: Page) {
  // The menu uses the original select-then-activate dial; other scenes use the common menu.
  if (new URL(page.url()).hash.startsWith('#/menu?')) {
    const sortie = page.getByRole('button', { name: '出征 · 编队并进入副本', exact: true });
    await sortie.click(); await sortie.click();
  } else await page.getByRole('link', { name: '出征编队', exact: true }).click();
}
export async function depart(page: Page, count = 5) {
  await openSortie(page);
  // The outgoing page also has zero loading indicators. Wait for the destination
  // before checking map readiness, otherwise a fast click races the texture load.
  await expect(page).toHaveURL(/#\/map\?save=.+&epoch=.+/); await ready(page);
  await expect(page.locator('.abyssa-map-loading')).toHaveCount(0, { timeout: 30_000 });
  await page.getByRole('button', { name: '查看出战队伍并编队' }).click();
  for (const id of ['eustice', 'kororo', 'elora', 'norma'].slice(0, count - 1)) {
    // Posters expose a stable character id; names remain localized presentation.
    await page.locator(`.abyssa-sortie-poster[data-member="${id}"]`).click();
  }
  await page.getByRole('button', { name: '完成编队', exact: true }).click();
  await expect(page.locator('.abyssa-map-viewport')).toHaveAttribute('data-mode', 'map');
  await page.screenshot({ path: test.info().outputPath(`map-${count}-members.png`) });
  const canvas = page.locator('.abyssa-map-scene canvas'); const bounds = (await canvas.boundingBox())!;
  const camera = new PerspectiveCamera(30.5, bounds.width / bounds.height, 0.1, 100);
  camera.position.set(0, 17, 22); camera.lookAt(0, -0.5, 0); camera.updateMatrixWorld();
  const point = new Vector3(-0.6, 1, 0.9).project(camera);
  await canvas.click({ position: { x: (point.x + 1) * bounds.width / 2, y: (1 - point.y) * bounds.height / 2 } });
  await page.getByRole('button', { name: '出发', exact: true }).click();
  await expect(page).toHaveURL(/#\/battle\?save=.+&epoch=.+&expedition=.+/); await ready(page);
  await expect(page.locator('.abyssa-expedition-party-card')).toHaveCount(count);
}
export async function finishFirstLayer(page: Page) {
  for (let round = 0; round < 16; round++) {
    if (await page.getByRole('dialog').count()) return;
    await page.getByRole('button', { name: 'ROLL', exact: true }).click();
    await expect(page.getByRole('button', { name: 'END TURN' })).toBeEnabled();
    for (let action = 0; action < 5; action++) {
      const { battle: state, faces } = await inspectPage(page);
      if (!state || state.mode.type !== 'player-turn' || state.enemies.every(e => e.hp <= 0)) break;
      const dieIndex = state.dice.findIndex((d, i) => !d.spent && !d.sealed && !state.party.find(m => m.id === d.ownerId)!.downed && ['attack', 'wild'].includes(faces[i]?.verb ?? ''));
      if (dieIndex < 0) break;
      const die = state.dice[dieIndex];
      if (!die.loaded) { await page.locator(`.abyssa-expedition-die-slot[data-owner="${die.ownerId}"] button`).click(); await expect(page.getByRole('button', { name: 'END TURN' })).toBeEnabled(); }
      await page.locator(`.abyssa-expedition-party-card[data-character="${die.ownerId}"]`).click();
      await page.locator('.abyssa-expedition-enemy[data-targetable="true"]').first().click();
      await expect.poll(async () => await page.getByRole('dialog').count() > 0 || await page.getByRole('button', { name: 'END TURN' }).isEnabled()).toBe(true);
      if (await page.getByRole('dialog').count()) return;
    }
    await page.getByRole('button', { name: 'END TURN' }).click();
    await expect.poll(async () => await page.getByRole('dialog').count() > 0 || await page.getByRole('button', { name: 'ROLL', exact: true }).isEnabled()).toBe(true);
  }
  throw new Error('No exit choice after 16 UI rounds');
}
export async function importSample(page: Page, kind: Parameters<typeof interruptionArchive>[0], prefix = '/') {
  await page.goto(`${prefix}title.html`);
  await page.getByRole('button', { name: '记录', exact: true }).click();
  await page.getByLabel('导入格式').selectOption('legacy');
  await page.getByLabel('导入存档', { exact: true }).setInputFiles({ name: `${kind}.json`, mimeType: 'application/json', buffer: Buffer.from(interruptionArchive(kind)) });
  await expect(page).toHaveURL(/#\/battle\?save=.+&epoch=.+&expedition=.+/); await ready(page);
}

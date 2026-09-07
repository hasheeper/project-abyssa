import { test, expect } from '@playwright/test';
import { entries } from '../../config/entries.mjs';
import { expectMounted, observeArtifacts } from './helpers';

for (const entry of entries.filter(entry => entry.kind !== 'game')) {
  test(`${entry.id} artifact mounts`, async ({ page }) => {
    const failures = await observeArtifacts(page);
    await page.goto(`/${entry.kind === 'tool' ? 'tools' : 'lab'}/${entry.html}`);
    await expectMounted(page);
    if (entry.id === 'studio') {
      await page.getByRole('button', { name: '爱心', exact: true }).first().click();
      await expect(page.locator('.abyssa-emote[data-emote="heart"]')).toBeAttached();
      await expect.poll(() => page.locator('.abyssa-emote img').evaluateAll(images => images.every(image => (image as HTMLImageElement).complete && (image as HTMLImageElement).naturalWidth > 0))).toBe(true);
    }
    if (entry.id === 'rp') {
      await page.getByRole('button', { name: '跳至终幕', exact: true }).click();
      await expect(page.locator('.abyssa-paper-doll').first()).toBeAttached();
      await expectMounted(page);
    }
    if (['studio', 'rp', 'novel'].includes(entry.id)) {
      await expect.poll(() => page.locator('.abyssa-paper-doll img').evaluateAll(images => images.length > 0 && images.every(image => (image as HTMLImageElement).complete && (image as HTMLImageElement).naturalWidth > 0))).toBe(true);
    }
    expect(failures).toEqual([]);
  });
}
test('tools index contains the five registered destinations', async ({ page }) => {
  await page.goto('/tools/');
  for (const entry of entries.filter(entry => entry.kind === 'tool')) await expect(page.locator(`a[href="./${entry.html}"]`)).toBeVisible();
});

/** Visual QA of frozen real-model archives through the normal import UI. No new generation. */
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from '@playwright/test';
const out = resolve(process.argv[2]), url = process.argv[3];
if (!url) throw Error('Usage: verify-airp-live-browser.mjs <live-report-directory> <game-url>');
const browser = await chromium.launch({ headless: true, executablePath: process.env.ABYSSA_BROWSER_EXECUTABLE });
const results = [];
try {
  for (const task of ['return', 'followup']) {
    const file = resolve(out, `${task}-unread-save.json`), archive = JSON.parse(await readFile(file, 'utf8'));
    const entry = archive.record.airpOnline.entries.at(-1);
    assert.equal(entry.source, 'generated'); assert.equal(entry.control, null);
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await context.route('**/api/v1/**', route => route.request().method() === 'POST' ? route.abort('blockedbyclient') : route.continue());
    const page = await context.newPage(), errors = [], modelPosts = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => { if (request.method() === 'POST' && request.url().includes('/api/v1/')) modelPosts.push(request.url()); });
    await page.goto(url); await page.getByRole('button', { name: '记录', exact: true }).click({ timeout: 60000 });
    await page.getByLabel('导入格式').selectOption('restore');
    await page.getByLabel('导入存档', { exact: true }).setInputFiles(file);
    await page.waitForURL(/#\/menu/, { timeout: 60000 });
    await page.goto(`${url}/#/mansion?save=${archive.record.head.saveId}&epoch=${archive.record.head.epoch}`);
    const settled = () => page.waitForFunction(() => document.querySelector('.rp-app__cue')?.textContent?.includes('下一句'), { timeout: 60000 });
    await settled();
    // Advance only before the final node; visual QA must never manufacture a second reading confirmation.
    const scene = archive.record.narrative.scenes.find(s => s.id === entry.sceneId);
    const firstDialogue = scene.body.nodes.findIndex(n => n.kind === 'beat' && n.frames.some(f => f.kind === 'dialogue'));
    if (firstDialogue > 0 && firstDialogue < scene.body.nodes.length - 1) {
      for (let i = 0; i < firstDialogue; i++) {
        await page.locator('.rp-app__cue').click();
        const expected = scene.body.nodes[i + 1].frames[0].text;
        await page.waitForFunction(text => document.querySelector('.rp-app')?.textContent?.includes(text), expected);
        await settled();
      }
    }
    await page.screenshot({ path: resolve(out, `${task}-avg.png`) });
    await page.getByText('AIRP · 连接与记录', { exact: true }).click();
    await page.getByText('前置创作记录', { exact: true }).click();
    assert.ok((await page.locator('.airp-creation-record').innerText()).length > 0);
    const bounds = await page.locator('.airp-story-tools__panel').boundingBox();
    assert.ok(bounds.y >= 0 && bounds.y + bounds.height <= 900);
    await page.screenshot({ path: resolve(out, `${task}-creation-record.png`) });
    assert.deepEqual(errors, []); assert.deepEqual(modelPosts, [], 'Reading a frozen sample must not automatically invoke a model');
    results.push({ task, status: 'passed', uncaughtErrors: 0, apiPosts: 0 });
    await context.close();
  }
  await writeFile(resolve(out, 'browser-qa.json'), JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results));
} finally { await browser.close(); }

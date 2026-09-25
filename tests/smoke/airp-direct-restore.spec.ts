import { expect, test } from '@playwright/test';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { hash } from '../../src/game-application/airp-generation/contracts';
import { directReady, manualDirectCopy, savedDirect } from './airp-direct-helpers';
import { openManorJournal } from './playable-helpers';

const folder = process.env.ABYSSA_AIRP_P2_PRIVATE_ARCHIVES;
test.skip(!folder, 'Explicit local real-archive replay only; no API calls');
for (const outcome of ['extracted', 'cleared'] as const) test(`real ${outcome} archive: UI restore, memory, manual copy/load and reload, zero external requests`, async ({page, context}, info) => {
  page.setDefaultTimeout(60000);
  const name = readdirSync(folder!).sort().find(n => n.startsWith(outcome + '-') && n.endsWith('.archive.local.json'));
  if (!name) throw Error('Missing local real archive');
  const filename = resolve(folder!, name), source = JSON.parse(readFileSync(filename, 'utf8')).record;
  let external = 0;
  const errors: string[] = [];
  page.on('pageerror', () => errors.push('page-error'));
  await context.route('**/*', async route => {
    if (new URL(route.request().url()).origin !== 'http://127.0.0.1:5199') {external++; await route.abort();}
    else await route.continue();
  });
  await page.goto('/'); await page.getByRole('button', {name: '记录', exact: true}).click();
  await page.getByRole('button', {name: '档案管理', exact: true}).click();
  await page.getByRole('button', {name: '导入档案', exact: true}).click();
  await page.getByLabel('导入格式').selectOption('restore');
  const started = Date.now();
  await page.getByLabel('导入存档', {exact: true}).setInputFiles(filename);
  await expect(page).toHaveURL(/#\/(menu|mansion)/, {timeout: 60000});
  await page.goto(`/#/mansion?save=${source.head.saveId}&epoch=${source.head.epoch}`); await directReady(page);
  const restoreUiMs = Date.now() - started;
  expect(hash(await savedDirect(page))).toBe(hash(source));
  await openManorJournal(page, '旧药箱的搭扣');
  await page.screenshot({path: info.outputPath('restored-real-memories.png')});
  const copyStarted = Date.now(), copies = await manualDirectCopy(page), copyLoadUiMs = Date.now() - copyStarted;
  await page.reload(); await directReady(page);
  expect(hash((await savedDirect(page)).airpDirect)).toBe(hash(source.airpDirect));
  expect(external).toBe(0); expect(errors.length).toBe(0);
  writeFileSync(info.outputPath('acceptance.json'), JSON.stringify({outcome, archive: name, restoreUiMs, copyLoadUiMs,
    source: copies.before.head, destination: copies.copy.head, ancestor: copies.copy.originRef?.source.head,
    directHash: hash(source.airpDirect), sameDirectState: true, memories: source.airpDirect.memories.length,
    sourceBytes: Buffer.byteLength(JSON.stringify(copies.before)), copyBytes: Buffer.byteLength(JSON.stringify(copies.copy)), externalRequests: external, errors}, null, 2));
});

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium, expect } from '@playwright/test';
import { projectRoot } from '../config/paths.mjs';
import { createArtifactServer } from './serve-built.mjs';
import { prepareAirpPages } from './prepare-airp-pages.mjs';

// Local CSP/UI preflight only: not a Cloudflare emulator, TLS, CORS or cache acceptance.
await prepareAirpPages(true);
const policy = await readFile(resolve(projectRoot, 'dist/game/_headers'), 'utf8');
const csp = /^  Content-Security-Policy: (.+)$/m.exec(policy)?.[1];
if (!csp) throw Error('Prepared CSP is missing.');
const server = createArtifactServer();
server.prependListener('request', (_request, response) => {
  response.setHeader('Content-Security-Policy', csp);
  response.setHeader('X-Frame-Options', 'DENY');
  response.setHeader('Referrer-Policy', 'no-referrer');
  response.setHeader('X-Content-Type-Options', 'nosniff');
});
await new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve(undefined)));
const address = server.address();
if (!address || typeof address === 'string') throw Error('Local listener missing.');
const origin = `http://127.0.0.1:${address.port}`;
let browser;
try {
  browser = await chromium.launch({args: ['--enable-unsafe-swiftshader'], executablePath: process.env.ABYSSA_BROWSER_EXECUTABLE});
  const context = await browser.newContext({viewport: {width: 1600, height: 900}, reducedMotion: 'reduce'});
  const page = await context.newPage();
  page.setDefaultTimeout(60000);
  /** @type {string[]} */
  const errors = [];
  /** @type {string[]} */
  const violations = [];
  let externalRequests = 0, modelRequests = 0;
  context.on('request', request => {
    if (new URL(request.url()).origin !== origin) externalRequests++;
    if (request.method() === 'POST') modelRequests++;
  });
  page.on('pageerror', () => errors.push('page-error'));
  await page.exposeFunction('recordCspFailure', () => violations.push('csp-violation'));
  await page.addInitScript(() => {
    document.addEventListener('securitypolicyviolation', () => {
      void /** @type {Window & {recordCspFailure?: () => Promise<void>}} */(window).recordCspFailure?.();
    });
  });
  const response = await page.goto(origin + '/');
  expect(response?.headers()['content-security-policy']).toBe(csp);
  await expect(page.getByRole('button', {name: '新的开始', exact: true})).toBeVisible({timeout: 60000});
  await page.goto(origin + '/title.html');
  await expect(page).toHaveURL(/index\.html#\/title/, {timeout: 60000});
  await page.getByRole('button', {name: '新的开始', exact: true}).click();
  await page.getByRole('textbox', {name: '请输入角色姓名'}).fill('林恩');
  await page.getByRole('button', {name: /下一步/}).click();
  await page.getByRole('radio', {name: '自由行动', exact: true}).click();
  await page.getByRole('button', {name: /下一步/}).click();
  await page.getByRole('button', {name: /开始游戏/}).click();
  await expect(page).toHaveURL(/#\/menu\?/, {timeout: 60000});
  const saveQuery = new URL(page.url()).hash.split('?')[1];
  await page.goto(origin + '/index.html#/mansion?' + saveQuery);
  await expect(page.getByRole('button', {name: '展开菜单', exact: true})).toBeVisible({timeout: 60000});
  await page.goto(origin + '/index.html#/settings?' + saveQuery);
  await page.getByRole('tab', {name: 'Model', exact: true}).click();
  await expect(page.getByRole('heading', {name: '服务连接', exact: true})).toBeVisible({timeout: 60000});
  await page.getByText('保存说明', {exact: true}).click();
  await expect(page.getByText('保存地址、Key 和模型，下次自动恢复。未保存的修改仅本次有效，不会自动调用模型。', {exact: true})).toBeVisible();
  await expect(page.getByText(/份作者资料全文保留/)).not.toBeVisible();
  for (const name of ['GM模型 ID', '正文模型 ID', '辅助模型 ID']) await expect(page.getByLabel(name, {exact: true})).toBeVisible();
  const bounds = await page.locator('.settings-app__panel').evaluate(element => ({height: element.clientHeight, content: element.scrollHeight}));
  expect(bounds.content).toBeLessThanOrEqual(bounds.height + 1);
  // The shared RpgCheckbox's native input is visually hidden; use its visible label.
  await page.locator('.airp-model').nth(1).locator('.airp-checkbox > label[for]').click();
  await expect(page.getByRole('checkbox', {name: '正文独立连接'})).toBeChecked();
  await page.getByLabel('正文 API 地址', {exact: true}).fill('https://synthetic.invalid/v1');
  await page.locator('.airp-model').nth(1).locator('.airp-model__advanced > summary').click();
  await page.getByLabel('正文 temperature', {exact: true}).fill('0.8');
  await page.getByLabel('导入测试配置', {exact: true}).setInputFiles({name: 'synthetic.json', mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify({version: 1, connection: {baseUrl: 'https://synthetic.invalid/v1', apiKey: 'synthetic-ui-test-key'},
      models: {planning: {model: 'gpt-5.6-sol'}, writing: {model: 'gemini-3.8-flash'}, updater: {model: 'deepseek-flash'}}}))});
  await expect(page.getByLabel('公共 API Key', {exact: true})).toHaveValue('synthetic-ui-test-key');
  await page.getByRole('tab', {name: 'Scene', exact: true}).click();
  await page.getByRole('tab', {name: 'Model', exact: true}).click();
  await expect(page.getByLabel('公共 API Key', {exact: true})).toHaveValue('synthetic-ui-test-key');
  // An imported but unsaved key remains in memory only. Reload must discard it.
  await page.reload();
  await page.getByRole('tab', {name: 'Model', exact: true}).click();
  await expect(page.getByLabel('导入测试配置', {exact: true})).toBeVisible({timeout: 60000});
  await expect(page.getByLabel('公共 API Key', {exact: true})).toHaveValue('');
  for (const path of ['/config/airp-test.local.json', '/dist/reports/airp-p3/pages-release.local.json', '/assets/not-a-real-chunk.js']) {
    const missing = await context.request.get(origin + path);
    expect(missing.status()).toBe(404);
  }
  expect(externalRequests).toBe(0); expect(modelRequests).toBe(0);
  expect(errors).toEqual([]); expect(violations).toEqual([]);
  console.log(JSON.stringify({localOnly: true, published: false, cspEnforced: true, legacyBookmark: true,
    directNewGame: true, aiSettings: true, externalRequests, modelRequests, pageErrors: errors.length, cspViolations: violations.length}));
} finally {
  await browser?.close();
  await new Promise(resolve => server.close(() => resolve(undefined)));
}

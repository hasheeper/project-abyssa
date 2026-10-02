import { chromium } from 'playwright';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const dir = dirname(fileURLToPath(import.meta.url));
const svg = await readFile(join(dir, 'opus-framework.svg'), 'utf8');
const html = `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8">
<title>图鉴大框 · Opus 5.5 v2</title>
<link rel="stylesheet" href="../../../src/assets/fonts/game-fonts.css">
<style>
*{box-sizing:border-box}html,body{margin:0;width:1600px;height:900px;overflow:hidden;background:#071011}
.canvas{position:relative;width:1600px;height:900px}
.canvas>img,.canvas>svg{position:absolute;inset:0;width:1600px;height:900px}
.canvas{font-family:"Noto Serif SC",serif}
</style></head><body><main class="canvas">
<img src="menu-shell.png" alt="当前 Menu 的子页外壳">
${svg}
</main></body></html>`;
await writeFile(join(dir, 'framework.html'), html);
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(pathToFileURL(join(dir, 'framework.html')).href);
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all([...document.images].map(image => image.decode()));
  });
  await page.screenshot({ path: join(dir, 'opus-framework.png') });
  if (errors.length) throw new Error(errors.join('\n'));
  console.log('Rendered opus-framework.png at 1600×900.');
} finally {
  await browser.close();
}

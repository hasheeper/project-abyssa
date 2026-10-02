import { chromium } from 'playwright';
import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';
import { createHash } from 'node:crypto';

const dir = dirname(fileURLToPath(import.meta.url));
const root = resolve(dir, '../../../..');
const report = join(root, 'dist/reports/codex-concept-2026-10-02/real-assets');
await mkdir(report, { recursive: true });

// One original runtime PNG. Neither the original art nor its alpha is edited.
const entries = [
  {
    id: 'slime', name: '浊泥史莱姆', english: 'MIRE SLIME',
    source: 'src/assets/battle/tide-reef/enemy.slime.mire.png',
    traits: ['浊泥色的半透明躯体', '泥水中夹杂碎石与贝壳'],
  },
];
const font = await readFile(join(root, 'src/assets/fonts/game-fonts.css'), 'utf8');
// Use data URLs to render without a server or an external font request.
const fontPaths = [...font.matchAll(/url\(\.\/([^)]*)\)/g)].map(match => match[1]);
const fontUrls = new Map();
for (const name of fontPaths) {
  const bytes = await readFile(join(root, 'src/assets/fonts', name));
  fontUrls.set(name, `data:font/woff2;base64,${bytes.toString('base64')}`);
}
const fontCss = font.replace(/url\(\.\/([^)]*)\)/g, (_, name) => `url(${fontUrls.get(name)})`);
const shell = `data:image/png;base64,${(await readFile(join(dir, '../menu-shell.png'))).toString('base64')}`;
const art = [];
const manifest = {
  date: '2026-10-02',
  purpose: 'Image-AI reference using real shipped enemy assets; not a finished or implemented UI',
  baseFramework: '../opus-framework.svg',
  menuReference: '../menu-reference.png',
  changes: 'Main agent adapts Opus v2 open page to the real art. Illustrations shown at moderate size; no new illustration, environment or alternate pose is generated.',
  assets: [],
};
for (const entry of entries) {
  const bytes = await readFile(join(root, entry.source));
  art.push({ ...entry, image: `data:image/png;base64,${bytes.toString('base64')}` });
  manifest.assets.push({
    id: entry.id, name: entry.name, source: entry.source,
    bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex'),
    previewProcessing: 'Read alpha bounds and fit the original pixels into the reference composition; no repaint, recolor or shape change',
  });
  await copyFile(join(root, entry.source), join(report, entry.source.split('/').at(-1)));
}
const css = `
*{box-sizing:border-box}html,body{margin:0;width:1600px;height:900px;overflow:hidden;background:#071011}
body{font-family:'Noto Serif SC','Songti SC',serif;color:#d7d9ce}
.page{position:relative;width:1600px;height:900px;overflow:hidden}
.shell{position:absolute;inset:0;width:100%;height:100%}
.categories{position:absolute;left:440px;top:56px;display:flex;align-items:center;gap:54px;font-size:20px;color:#86958e;letter-spacing:3px}
.categories b{font-weight:500;color:#d8d7c8;padding-bottom:10px;border-bottom:1px solid #b8c7bd}
.index{position:absolute;left:284px;top:188px;width:190px;font-size:18px;color:#8b9b94;letter-spacing:1px}
.index small{display:block;color:#667c75;font-size:12px;letter-spacing:3px;margin-bottom:24px}
.index div{height:52px;display:flex;align-items:center;position:relative;white-space:nowrap}
.index .selected{color:#e2ddca}
.index .selected:before{content:'';position:absolute;left:-20px;width:3px;height:20px;background:#abc1b4}
.index .selected:after{content:'';position:absolute;bottom:4px;left:0;width:100px;height:1px;background:linear-gradient(90deg,#8da99b80,transparent)}
.top-rule,.bottom-rule{position:absolute;left:536px;right:40px;height:1px;background:linear-gradient(90deg,#90a89a70,#90a89a55,transparent)}
.top-rule{top:180px}.bottom-rule{top:820px}
.illustration{position:absolute;left:540px;top:266px;width:488px;height:442px;display:flex;align-items:center;justify-content:center}
.illustration:before{content:'';position:absolute;inset:0;background:radial-gradient(ellipse at 50% 55%,#a5b6a124,transparent 70%);pointer-events:none}
.art{position:relative;width:488px;height:442px}
.figure-caption{position:absolute;left:572px;top:722px;width:430px;font-size:13px;line-height:2;color:#8b9b92}
.figure-caption b{color:#b9c4b7;font-weight:400;font-size:15px}
.details{position:absolute;left:1060px;top:214px;width:474px}
h1{margin:0;color:#ece3cb;font-size:38px;font-weight:500;letter-spacing:4px}
.subtitle{margin:10px 0 38px;font-size:13px;letter-spacing:2px;color:#8c9e93}
.description{font-size:17px;line-height:1.9;margin:0;color:#bcc5b8}
.description span{display:block}
.section{margin-top:34px}
.section h2{margin:0 0 20px;font-size:18px;font-weight:400;color:#d5d9c8;letter-spacing:3px}
.rows{display:grid;gap:18px;font-size:15px;line-height:1.7;color:#a9b6a9}
.rows p{margin:0}
.rows .unknown{color:#647b70}
.text-lines{display:grid;gap:14px;margin-top:18px}
.text-lines i{display:block;height:4px;background:#b8c4ae25;border-radius:0}
.text-lines i:nth-child(2){width:91%}.text-lines i:nth-child(3){width:73%}
`;

function pageHtml(entry) {
  const names = ['浊泥史莱姆', '硬壳礁蟹', '藏壳海蛭', '亡命徒·刀手', '亡命徒·弩手', '刻仪兽', '落幕管家'];
  const list = names.map(name => `<div class="${entry.name === name ? 'selected' : ''}">${name}</div>`).join('');
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>真实素材构图参考：${entry.name}</title><style>${fontCss}\n${css}</style></head><body>
<main class="page"><img class="shell" src="${shell}" alt="当前 Menu 子页外壳">
<div class="categories"><b>生物</b><span>地点</span><span>器物</span><span>世界知识</span></div>
<aside class="index"><small>条目索引</small>${list}</aside>
<div class="top-rule"></div><div class="bottom-rule"></div>
<div class="illustration"><canvas class="art" width="976" height="884"></canvas></div>
<div class="figure-caption"><b>形态记录</b><br>${entry.traits.join(' · ')}</div>
<section class="details"><h1>${entry.name}</h1><p class="subtitle">${entry.english}</p>
<p class="description">${entry.traits.map(text => `<span>${text}</span>`).join('')}</p>
<div class="section"><h2>已知情报</h2><div class="rows"><p>形态与特征</p><p>出没与行动</p><p class="unknown">尚待补全的记录</p></div><div class="text-lines"><i></i><i></i><i></i></div></div>
<div class="section"><h2>相关记录</h2><div class="text-lines"><i></i><i></i><i></i></div></div>
</section></main></body></html>`;
}

// Preview crops only transparent margins. Every visible source pixel is retained.
async function drawAsset(page, entry, selector = '.art', maxWidth = 870, maxHeight = 680) {
  return page.evaluate(async ({ entry, selector, maxWidth, maxHeight }) => {
    const image = new Image(); image.src = entry.image; await image.decode();
    const buffer = document.createElement('canvas'); buffer.width = image.width; buffer.height = image.height;
    const ctx = buffer.getContext('2d'); ctx.drawImage(image, 0, 0);
    const pixels = ctx.getImageData(0, 0, image.width, image.height).data;
    let left = image.width, top = image.height, right = 0, bottom = 0;
    for (let y = 0; y < image.height; y++) for (let x = 0; x < image.width; x++) {
      if (pixels[(y * image.width + x) * 4 + 3] === 0) continue;
      left = Math.min(left, x); top = Math.min(top, y); right = Math.max(right, x + 1); bottom = Math.max(bottom, y + 1);
    }
    const canvas = document.querySelector(selector); const context = canvas.getContext('2d');
    const scale = Math.min(maxWidth / (right - left), maxHeight / (bottom - top));
    const width = (right - left) * scale, height = (bottom - top) * scale;
    context.drawImage(image, left, top, right - left, bottom - top, (canvas.width - width) / 2, (canvas.height - height) / 2, width, height);
    return { original: [image.width, image.height], alphaBounds: [left, top, right, bottom], displayed: [Math.round(width / 2), Math.round(height / 2)] };
  }, { entry, selector, maxWidth, maxHeight });
}

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
  for (const entry of art) {
    const html = pageHtml(entry);
    await page.setContent(html);
    await page.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.images].map(image => image.decode())); });
    const metrics = await drawAsset(page, entry);
    // Capture pixels only; the brief asks the image AI to design the UI around this art.
    await page.screenshot({ path: join(dir, `layout-${entry.id}.png`) });
    await copyFile(join(dir, `layout-${entry.id}.png`), join(report, `layout-${entry.id}.png`));
    manifest.assets.find(asset => asset.id === entry.id).previewMetrics = metrics;
    console.log(JSON.stringify({ name: entry.name, ...metrics }));
  }
  await copyFile(join(dir, '../menu-reference.png'), join(report, 'menu-reference.png'));
} finally {
  await browser.close();
}
for (const filename of ['layout-slime.png']) {
  const bytes = await readFile(join(dir, filename));
  (manifest.outputs ??= []).push({ filename, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') });
}
await writeFile(join(dir, 'sources.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log('Real-art reference compositions and original PNG delivery copies prepared.');

import assert from 'node:assert/strict';
import { chromium, expect } from '@playwright/test';

// Requires the local Vite game server. Isolated context; no screenshots,
// recording, trace, persistent profile, API configuration or real save access.
const origin = new URL(process.argv[2] ?? 'http://127.0.0.1:5190').origin;
assert.ok(['127.0.0.1', 'localhost'].includes(new URL(origin).hostname));
const browser = await chromium.launch({ executablePath: process.env.ABYSSA_BROWSER_EXECUTABLE });
try {
  const context = await browser.newContext({ viewport: { width: 1600, height: 900 }, reducedMotion: 'no-preference' });
  const page = await context.newPage();
  const errors = [], blocked = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url());
    if (url.origin !== origin || request.method() !== 'GET') {
      blocked.push({ path: url.pathname, method: request.method() });
      return route.abort();
    }
    if (url.pathname === '/__airp-reading-check__') return route.fulfill({ contentType: 'text/html', body: `<!doctype html><html><head><meta charset="utf-8"></head><body><div id="root"></div><script type="module">
      import RefreshRuntime from '/@react-refresh';
      RefreshRuntime.injectIntoGlobalHook(window);
      window.$RefreshReg$ = () => {};
      window.$RefreshSig$ = () => type => type;
      window.__vite_plugin_react_preamble_installed__ = true;
      window.readingAnimations = [];
      document.addEventListener('animationstart', event => window.readingAnimations.push(event.animationName));
      window.readingFixture = await import('/tests/smoke/fixtures/airp-reading.tsx');
      window.readingFixture.start();
    </script></body></html>` });
    if (url.pathname === '/src/game-client/airp-director/useDirector.ts') return route.fulfill({ contentType: 'text/javascript', body: 'export function useDirector() { return window.readingFixture.director; }' });
    return route.continue();
  });
  await page.goto(origin + '/__airp-reading-check__');
  const sequence = page.locator('.scene-sequence');
  await expect(sequence).toHaveAttribute('data-phase', 'idle', { timeout: 20000 });
  await expect(page.locator('.abyssa-stage')).toHaveCount(1);
  await expect(page.locator('.abyssa-stage__canvas > .scene-sequence')).toHaveCount(1);
  await expect(page.locator('[data-character="kael"]')).toHaveCount(0);
  await expect(page.locator('.rp-adv__actor[data-character="elora"]')).toHaveCount(1);
  const animations = await page.evaluate(() => window.readingAnimations);
  assert.ok(animations.includes('scene-dialogue-in'), JSON.stringify(animations));
  assert.ok(animations.includes('scene-cast-in'), JSON.stringify(animations));

  const measurements = [];
  for (const viewport of [{ width: 1600, height: 900 }, { width: 2332, height: 1502 }, { width: 1440, height: 900 }, { width: 1166, height: 751 }]) {
    await page.setViewportSize(viewport);
    await expect.poll(() => page.locator('.abyssa-stage__canvas').evaluate(el => Number(el.style.getPropertyValue('--abyssa-stage-scale'))))
      .toBe(Math.min(viewport.width / 1600, viewport.height / 900));
    const geometry = await page.evaluate(() => {
      const canvas = document.querySelector('.abyssa-stage__canvas'), footer = document.querySelector('.rp-app__bar');
      const rect = element => { const r = element.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height, right: r.right, bottom: r.bottom }; };
      const within = (child, parent) => child.x >= parent.x - 1 && child.y >= parent.y - 1 && child.right <= parent.right + 1 && child.bottom <= parent.bottom + 1;
      const cr = rect(canvas), fr = rect(footer);
      return {
        scale: Number(canvas.style.getPropertyValue('--abyssa-stage-scale')),
        canvas: cr, footer: fr, footerCssHeight: getComputedStyle(footer).height,
        dialogue: rect(document.querySelector('.rp-adv__dialogue')),
        buttons: [...footer.querySelectorAll('button')].map(button => ({ label: button.getAttribute('aria-label'), ...rect(button), insideFooter: within(rect(button), fr) })),
        footerInsideCanvas: within(fr, cr),
        dialogueInsideCanvas: within(rect(document.querySelector('.rp-adv__dialogue')), cr),
      };
    });
    assert.equal(geometry.footerCssHeight, '52px');
    assert.ok(Math.abs(geometry.footer.height / geometry.scale - 52) < 0.1);
    assert.ok(geometry.footerInsideCanvas && geometry.dialogueInsideCanvas, JSON.stringify(geometry));
    assert.ok(geometry.buttons.every(button => button.insideFooter), JSON.stringify(geometry));
    measurements.push({ viewport, ...geometry });
  }
  await page.evaluate(() => window.readingFixture.renderAt(2));
  await expect(page.getByText('林恩', { exact: true })).toBeVisible();
  await expect(sequence).toHaveAttribute('data-phase', 'idle');
  await expect(page.locator('[data-character="kael"]')).toHaveCount(0);
  assert.equal((await page.evaluate(() => window.readingAnimations)).filter(name => name === 'scene-cast-in').length, animations.filter(name => name === 'scene-cast-in').length);
  await page.getByRole('button', { name: '关闭当前场景（保留进度）' }).click();
  await expect(sequence).toHaveCount(0);
  assert.deepEqual(await page.evaluate(() => window.readingFixture.commands), [{ type: 'airp-director-pause' }]);
  assert.deepEqual(errors, []);
  assert.deepEqual(blocked, []);
  console.log(JSON.stringify({ measurements, animations, povOffstage: true, entranceReplayed: false, closeOnlyPauses: true, pageErrors: errors, modelRequests: 0 }, null, 2));
} finally {
  await browser.close();
}

import { expect, type Page } from '@playwright/test';

export async function observeArtifacts(page: Page) {
  const failures: string[] = [];
  page.on('pageerror', error => failures.push(error.message));
  page.on('response', response => {
    if (response.status() >= 400 && !response.url().endsWith('/favicon.ico')) failures.push(`${response.status()} ${response.url()}`);
  });
  page.on('requestfailed', request => {
    const reason = request.failure()?.errorText;
    // 正常跨页会取消尚未完成的请求；其他传输失败不能当作资源已加载。
    if (reason && reason !== 'net::ERR_ABORTED' && !request.url().endsWith('/favicon.ico')) failures.push(`${reason} ${request.url()}`);
  });
  await page.route('**/*', route => {
    const url = new URL(route.request().url());
    const existingArtHosts = ['files.catbox.moe', 'fonts.googleapis.com', 'fonts.gstatic.com'];
    const isLocal = url.hostname === '127.0.0.1';
    if (/^https?:$/.test(url.protocol) && ((isLocal && (url.port !== (process.env.ABYSSA_SMOKE_PORT ?? '5199') || /(?:^|\/)api\//.test(url.pathname))) || (!isLocal && !existingArtHosts.includes(url.hostname)))) {
      failures.push(`Unexpected external request: ${url}`);
      return route.abort();
    }
    return route.continue();
  });
  return failures;
}

export async function expectMounted(page: Page) {
  await expect(page.locator('#root > *').first()).toBeAttached();
  await page.waitForLoadState('networkidle');
  await expect(page.locator('#root')).not.toBeEmpty();
  // Game shell can mount its loading curtain before the route is actually ready.
  if (page.url().includes('#/')) {
    await expect(page.locator('html')).toHaveAttribute('data-game-page', /.+/, {timeout:30_000});
    await expect(page.locator('html')).not.toHaveAttribute('data-scene-transition', /.+/, {timeout:30_000});
  }
}

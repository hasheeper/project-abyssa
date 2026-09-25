import { defineConfig } from '@playwright/test';
import { fileURLToPath } from 'node:url';

/** Explicit P2 acceptance. Never record a trace, HAR or populated credentials screenshot. */
export default defineConfig({
  testDir: '../tests/smoke', testMatch: ['airp-direct.spec.ts', 'airp-direct-faults.spec.ts'],
  outputDir: '../dist/reports/airp-p2/browser', timeout: 900000, workers: 1, retries: 0,
  // Full-author-material archives replay their provenance on import/reload.
  // Playwright action timeouts do not change its separate 5-second expect limit.
  expect: {timeout: 60000},
  reporter: [['list']],
  use: {baseURL: 'http://127.0.0.1:5199', browserName: 'chromium', viewport: {width: 1600, height: 900}, reducedMotion: 'reduce',
    screenshot: 'off', trace: 'off', video: 'off', launchOptions: {args: ['--enable-unsafe-swiftshader']}},
  webServer: {command: 'node scripts/serve-built.mjs', cwd: fileURLToPath(new URL('../', import.meta.url)), url: 'http://127.0.0.1:5199/', reuseExistingServer: true},
});

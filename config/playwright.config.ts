import { defineConfig } from '@playwright/test';
import { resolve } from 'node:path';
import { projectRoot } from './paths.mjs';

const port = Number(process.env.ABYSSA_SMOKE_PORT ?? 5199);
export default defineConfig({
  testDir: '../tests/smoke',
  outputDir: '../dist/reports/browser',
  timeout: 45_000,
  workers: 2,
  retries: 0,
  reporter: [['list'], ['json', { outputFile: resolve(projectRoot, 'dist/reports/smoke.json') }]],
  use: {
    baseURL: `http://127.0.0.1:${port}`, browserName: 'chromium',
    viewport: { width: 1600, height: 900 }, reducedMotion: 'reduce',
    screenshot: 'only-on-failure', trace: 'retain-on-failure',
    launchOptions: { args: ['--enable-unsafe-swiftshader'], executablePath: process.env.ABYSSA_BROWSER_EXECUTABLE },
  },
  projects: [
    { name: 'game', testMatch: ['game.spec.ts', 'character.spec.ts', 'manor.spec.ts', 'memory.spec.ts', 'growth.spec.ts'] },
    { name: 'workbench', testMatch: 'workbench.spec.ts' },
    { name: 'storage', testMatch: 'storage.spec.ts' },
  ],
  webServer: { command: 'node scripts/serve-built.mjs', cwd: projectRoot, url: `http://127.0.0.1:${port}/`, reuseExistingServer: false, timeout: 15_000 },
});

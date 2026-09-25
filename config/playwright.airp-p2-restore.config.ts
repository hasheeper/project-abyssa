import { defineConfig } from '@playwright/test';
import base from './playwright.airp-p2.config';

/** Local-only replay of already paid artifacts; every external request is denied. */
export default defineConfig({...base, testMatch: 'airp-direct-restore.spec.ts',
  outputDir: '../dist/reports/airp-p2/browser-real-restore', timeout: 300000});

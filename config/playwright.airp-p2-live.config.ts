import { defineConfig } from '@playwright/test';
import mock from './playwright.airp-p2.config';

/** Requires explicit opt-in and the separately recorded cumulative call allowance. */
export default defineConfig({...mock, testMatch: 'airp-direct-live.spec.ts',
  outputDir: '../dist/reports/airp-p2/live-final', timeout: 1200000});

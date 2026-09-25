import { defineConfig } from "@playwright/test";
import { projectRoot } from "./paths.mjs";
export default defineConfig({
  testDir: "../tests/smoke",
  testMatch: "airp-static.spec.ts",
  outputDir: "../dist/reports/airp-static-browser",
  timeout: 45000,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: "http://127.0.0.1:5195",
    browserName: "chromium",
    viewport: { width: 1600, height: 1000 },
    reducedMotion: "reduce",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    launchOptions: { executablePath: process.env.ABYSSA_BROWSER_EXECUTABLE },
  },
  webServer: {
    cwd: projectRoot,
    command: "node scripts/run-target.mjs preview entry:airp --no-open",
    url: "http://127.0.0.1:5195/airp.html",
    // Explicit opt-in for running mocks alongside a verified static preview.
    reuseExistingServer: process.env.ABYSSA_AIRP_REUSE_PREVIEW === "1",
    timeout: 15000,
  },
});

import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // DOM／演出用例较重；固定并发，避免随本机核心数放大争用而触发超时。
    maxWorkers: 2,
    // File-only projects in Vitest 3 force the root to the config directory.
    // Explicit roots keep test discovery anchored to this repository.
    projects: [
      { extends: "config/vitest/core.config.ts", root: "." },
      { extends: "config/vitest/app.config.ts", root: "." },
      { extends: "config/vitest/application.config.ts", root: "." }
    ]
  }
});

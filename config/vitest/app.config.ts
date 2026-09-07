import { defineProject } from "vitest/config";

export default defineProject({
  test: {
    name: "app",
    include: ["src/**/*.test.{ts,tsx}"],
    exclude: ["src/game-core/**", "src/game-runtime/testing/**", "src/game-application/**", "src/game-infrastructure/**", "src/apps/battle/module-boundaries.test.ts"],
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    css: true
  }
});

import { defineProject } from "vitest/config";

if (process.env.UPDATE_BATTLE_BASELINE === "1") {
  throw new Error("Core verification requires frozen Battle expectations; unset UPDATE_BATTLE_BASELINE.");
}

export default defineProject({
  test: {
    name: "core",
    include: ["src/game-core/**/*.test.ts", "src/game-runtime/testing/**/*.test.ts", "src/apps/battle/module-boundaries.test.ts"],
    environment: "node",
    setupFiles: [],
    benchmark: { include: ["src/game-core/**/*.bench.ts", "src/game-runtime/testing/**/*.bench.ts"] }
  }
});
